import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { Thread, Board, Group, ForumUser } from '@/models/forum';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * GET /api/forum/threads - Get threads (with filters)
 * POST /api/forum/threads - Create a new thread
 */

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    
    const { searchParams } = new URL(request.url);
    const boardId = searchParams.get('board');
    const boardSlug = searchParams.get('boardSlug');
    const groupId = searchParams.get('group');
    const groupSlug = searchParams.get('groupSlug');
    const authorId = searchParams.get('author');
    const type = searchParams.get('type');
    const search = searchParams.get('search');
    const tag = searchParams.get('tag');
    const sort = searchParams.get('sort') || 'latest';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
    const skip = (page - 1) * limit;
    
    // Build query
    const query: Record<string, unknown> = { 
      isDeleted: false,
      isHidden: false,
    };
    
    // Board filter
    if (boardId) {
      query.board = boardId;
    } else if (boardSlug) {
      const board = await Board.findOne({ slug: boardSlug });
      if (board) {
        query.board = board._id;
      }
    }
    
    // Group filter
    if (groupId) {
      query.group = groupId;
    } else if (groupSlug) {
      const group = await Group.findOne({ slug: groupSlug });
      if (group) {
        query.group = group._id;
      }
    }
    
    if (authorId) {
      query.author = authorId;
    }
    
    if (type) {
      query.type = type;
    }
    
    if (tag) {
      query.tags = tag.toLowerCase();
    }
    
    if (search) {
      query.$text = { $search: search };
    }
    
    // Sort options
    const sortOptions: Record<string, Record<string, 1 | -1 | { $meta: string }>> = {
      latest: { isPinned: -1, lastReplyAt: -1, createdAt: -1 },
      newest: { isPinned: -1, createdAt: -1 },
      hot: { isPinned: -1, hotScore: -1 },
      top: { isPinned: -1, likeCount: -1 },
      mostViewed: { isPinned: -1, viewCount: -1 },
      mostReplies: { isPinned: -1, replyCount: -1 },
    };
    
    // If text search, add relevance score
    if (search) {
      sortOptions.relevant = { score: { $meta: 'textScore' } };
    }
    
    const threadsQuery = Thread.find(query)
      .select('-contentHtml -content')
      .populate('author', 'username displayName avatar reputation')
      .populate('board', 'name slug color')
      .populate('group', 'name slug avatar')
      .populate('lastReplyBy', 'username avatar')
      .sort(sortOptions[sort] || sortOptions.latest)
      .skip(skip)
      .limit(limit);
    
    if (search) {
      threadsQuery.select({ score: { $meta: 'textScore' } });
    }
    
    const [threads, total] = await Promise.all([
      threadsQuery.lean(),
      Thread.countDocuments(query),
    ]);
    
    return NextResponse.json({
      success: true,
      data: threads,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching threads:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch threads' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    await connectDB();
    
    // Get forum user
    const forumUser = await ForumUser.findOne({ authId: user.id });
    if (!forumUser) {
      return NextResponse.json(
        { success: false, error: 'Please create a forum profile first' },
        { status: 400 }
      );
    }
    
    if (forumUser.isBanned) {
      return NextResponse.json(
        { success: false, error: 'Your account is banned' },
        { status: 403 }
      );
    }
    
    const body = await request.json();
    const { 
      title, 
      content, 
      boardId, 
      groupId, 
      type = 'discussion',
      tags = [],
      images = [],
      videos = [],
      poll,
      vehicle,
      forSale,
      event,
    } = body;
    
    if (!title || !content) {
      return NextResponse.json(
        { success: false, error: 'Title and content are required' },
        { status: 400 }
      );
    }
    
    if (!boardId && !groupId) {
      return NextResponse.json(
        { success: false, error: 'Board or group is required' },
        { status: 400 }
      );
    }
    
    // Verify board/group exists and user can post
    if (boardId) {
      const board = await Board.findById(boardId);
      if (!board) {
        return NextResponse.json(
          { success: false, error: 'Board not found' },
          { status: 404 }
        );
      }
      
      if (board.isLocked && forumUser.role === 'member') {
        return NextResponse.json(
          { success: false, error: 'This board is locked' },
          { status: 403 }
        );
      }
      
      if (board.settings.minRepToPost > forumUser.reputation && forumUser.role === 'member') {
        return NextResponse.json(
          { success: false, error: `You need ${board.settings.minRepToPost} reputation to post here` },
          { status: 403 }
        );
      }
    }
    
    if (groupId) {
      const group = await Group.findById(groupId);
      if (!group) {
        return NextResponse.json(
          { success: false, error: 'Group not found' },
          { status: 404 }
        );
      }
      
      // Check membership
      const isMember = group.members.some(m => m.userId.toString() === forumUser._id.toString());
      if (!isMember && group.type !== 'public') {
        return NextResponse.json(
          { success: false, error: 'You must be a member of this group to post' },
          { status: 403 }
        );
      }
    }
    
    // Generate slug
    const baseSlug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 80);
    
    // Make slug unique by appending random string
    const slug = `${baseSlug}-${Date.now().toString(36)}`;
    
    // Generate excerpt
    const excerpt = content.substring(0, 300).replace(/\n/g, ' ').trim();
    
    const thread = new Thread({
      title,
      slug,
      content,
      excerpt,
      author: forumUser._id,
      authorUsername: forumUser.username,
      authorAvatar: forumUser.avatar,
      board: boardId || undefined,
      group: groupId || undefined,
      type,
      tags: tags.map((t: string) => t.toLowerCase()),
      images,
      videos,
      poll: type === 'poll' ? poll : undefined,
      vehicle,
      forSale: type === 'for-sale' ? forSale : undefined,
      event: type === 'event' ? event : undefined,
    });
    
    await thread.save();
    
    // Update user stats
    forumUser.threadCount += 1;
    forumUser.lastActiveAt = new Date();
    await forumUser.save();
    
    // Update board/group stats
    if (boardId) {
      await Board.findByIdAndUpdate(boardId, {
        $inc: { threadCount: 1 },
        lastThreadId: thread._id,
        lastThreadTitle: thread.title,
        lastPostAt: new Date(),
        lastPostBy: forumUser._id,
      });
    }
    
    if (groupId) {
      await Group.findByIdAndUpdate(groupId, {
        $inc: { threadCount: 1 },
        lastActivityAt: new Date(),
        lastThreadId: thread._id,
      });
    }
    
    // Populate for response
    await thread.populate('author', 'username displayName avatar reputation');
    await thread.populate('board', 'name slug');
    await thread.populate('group', 'name slug');
    
    return NextResponse.json({
      success: true,
      data: thread,
    });
  } catch (error) {
    console.error('Error creating thread:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create thread' },
      { status: 500 }
    );
  }
}
