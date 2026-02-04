import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { Comment, Thread, ForumUser, Board, Group } from '@/models/forum';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * GET /api/forum/comments - Get comments for a thread
 * POST /api/forum/comments - Create a new comment
 */

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    
    const { searchParams } = new URL(request.url);
    const threadId = searchParams.get('thread');
    const parentId = searchParams.get('parent');
    const sort = searchParams.get('sort') || 'oldest';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const skip = (page - 1) * limit;
    
    if (!threadId) {
      return NextResponse.json(
        { success: false, error: 'Thread ID is required' },
        { status: 400 }
      );
    }
    
    // Build query
    const query: Record<string, unknown> = { 
      thread: threadId,
      isDeleted: false,
      isHidden: false,
    };
    
    if (parentId === 'null' || parentId === '') {
      // Top-level comments only
      query.parentComment = { $exists: false };
    } else if (parentId) {
      // Replies to a specific comment
      query.parentComment = parentId;
    }
    
    // Sort options
    const sortOptions: Record<string, Record<string, 1 | -1>> = {
      oldest: { createdAt: 1 },
      newest: { createdAt: -1 },
      top: { likeCount: -1, createdAt: 1 },
    };
    
    const [comments, total] = await Promise.all([
      Comment.find(query)
        .populate('author', 'username displayName avatar reputation role')
        .populate('quotedComment', 'content authorUsername')
        .sort(sortOptions[sort] || sortOptions.oldest)
        .skip(skip)
        .limit(limit)
        .lean(),
      Comment.countDocuments(query),
    ]);
    
    // If getting top-level comments, also get reply counts
    if (!parentId || parentId === 'null' || parentId === '') {
      const commentsWithReplies = await Promise.all(
        comments.map(async (comment) => {
          const replyCount = await Comment.countDocuments({
            parentComment: comment._id,
            isDeleted: false,
          });
          return { ...comment, replyCount };
        })
      );
      
      return NextResponse.json({
        success: true,
        data: commentsWithReplies,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    }
    
    return NextResponse.json({
      success: true,
      data: comments,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching comments:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch comments' },
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
      threadId, 
      parentCommentId, 
      content, 
      images = [],
      quotedCommentId,
      quotedText,
    } = body;
    
    if (!threadId || !content) {
      return NextResponse.json(
        { success: false, error: 'Thread ID and content are required' },
        { status: 400 }
      );
    }
    
    // Verify thread exists and is not locked
    const thread = await Thread.findById(threadId);
    if (!thread) {
      return NextResponse.json(
        { success: false, error: 'Thread not found' },
        { status: 404 }
      );
    }
    
    if (thread.isLocked && forumUser.role === 'member') {
      return NextResponse.json(
        { success: false, error: 'This thread is locked' },
        { status: 403 }
      );
    }
    
    // Calculate depth for nested replies
    let depth = 0;
    if (parentCommentId) {
      const parentComment = await Comment.findById(parentCommentId);
      if (!parentComment) {
        return NextResponse.json(
          { success: false, error: 'Parent comment not found' },
          { status: 404 }
        );
      }
      depth = Math.min(parentComment.depth + 1, 5); // Max depth of 5
    }
    
    // Extract mentions from content
    const mentionRegex = /@(\w+)/g;
    const mentionMatches = content.match(mentionRegex) || [];
    const mentionUsernames = mentionMatches.map((m: string) => m.slice(1).toLowerCase());
    const mentionedUsers = await ForumUser.find({ 
      username: { $in: mentionUsernames } 
    }).select('_id');
    
    const comment = new Comment({
      thread: threadId,
      parentComment: parentCommentId || undefined,
      depth,
      author: forumUser._id,
      authorUsername: forumUser.username,
      authorAvatar: forumUser.avatar,
      content,
      images,
      mentions: mentionedUsers.map(u => u._id),
      quotedComment: quotedCommentId || undefined,
      quotedText: quotedText || undefined,
    });
    
    await comment.save();
    
    // Update thread stats
    thread.replyCount += 1;
    thread.lastReplyAt = new Date();
    thread.lastReplyBy = forumUser._id;
    thread.lastReplyUsername = forumUser.username;
    await thread.save();
    
    // Update parent comment reply count
    if (parentCommentId) {
      await Comment.findByIdAndUpdate(parentCommentId, {
        $inc: { replyCount: 1 },
      });
    }
    
    // Update user stats
    forumUser.postCount += 1;
    forumUser.lastActiveAt = new Date();
    await forumUser.save();
    
    // Update board/group post count
    if (thread.board) {
      await Board.findByIdAndUpdate(thread.board, {
        $inc: { postCount: 1 },
        lastPostAt: new Date(),
        lastPostBy: forumUser._id,
      });
    }
    
    if (thread.group) {
      await Group.findByIdAndUpdate(thread.group, {
        $inc: { postCount: 1 },
        lastActivityAt: new Date(),
      });
    }
    
    // TODO: Create notifications for thread author, mentioned users, parent comment author
    
    // Populate for response
    await comment.populate('author', 'username displayName avatar reputation role');
    
    return NextResponse.json({
      success: true,
      data: comment,
    });
  } catch (error) {
    console.error('Error creating comment:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create comment' },
      { status: 500 }
    );
  }
}
