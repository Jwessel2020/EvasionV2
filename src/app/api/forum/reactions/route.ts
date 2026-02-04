import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { Reaction, Thread, Comment, ForumUser } from '@/models/forum';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * GET /api/forum/reactions - Get reactions for content
 * POST /api/forum/reactions - Add/toggle a reaction
 * DELETE /api/forum/reactions - Remove a reaction
 */

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    
    const { searchParams } = new URL(request.url);
    const threadId = searchParams.get('thread');
    const commentId = searchParams.get('comment');
    
    if (!threadId && !commentId) {
      return NextResponse.json(
        { success: false, error: 'Thread ID or Comment ID is required' },
        { status: 400 }
      );
    }
    
    // Get reaction counts grouped by type
    const query = threadId ? { thread: threadId } : { comment: commentId };
    
    const reactions = await Reaction.aggregate([
      { $match: query },
      { 
        $group: { 
          _id: '$type', 
          count: { $sum: 1 },
          users: { $push: '$user' },
        } 
      },
    ]);
    
    // Get current user's reaction if logged in
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    let userReaction = null;
    if (user) {
      const forumUser = await ForumUser.findOne({ authId: user.id });
      if (forumUser) {
        const reaction = await Reaction.findOne({
          user: forumUser._id,
          ...(threadId ? { thread: threadId } : { comment: commentId }),
        });
        userReaction = reaction?.type || null;
      }
    }
    
    // Format response
    const reactionCounts: Record<string, number> = {};
    reactions.forEach((r) => {
      reactionCounts[r._id] = r.count;
    });
    
    const totalCount = reactions.reduce((sum, r) => sum + r.count, 0);
    
    return NextResponse.json({
      success: true,
      data: {
        counts: reactionCounts,
        total: totalCount,
        userReaction,
      },
    });
  } catch (error) {
    console.error('Error fetching reactions:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch reactions' },
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
    
    const forumUser = await ForumUser.findOne({ authId: user.id });
    if (!forumUser) {
      return NextResponse.json(
        { success: false, error: 'Please create a forum profile first' },
        { status: 400 }
      );
    }
    
    const body = await request.json();
    const { threadId, commentId, type = 'like' } = body;
    
    if (!threadId && !commentId) {
      return NextResponse.json(
        { success: false, error: 'Thread ID or Comment ID is required' },
        { status: 400 }
      );
    }
    
    const validTypes = ['like', 'love', 'laugh', 'wow', 'sad', 'angry', 'helpful', 'agree', 'disagree'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid reaction type' },
        { status: 400 }
      );
    }
    
    // Check if user already reacted
    const existingReaction = await Reaction.findOne({
      user: forumUser._id,
      ...(threadId ? { thread: threadId } : { comment: commentId }),
    });
    
    let action: 'added' | 'changed' | 'removed';
    
    if (existingReaction) {
      if (existingReaction.type === type) {
        // Same reaction - remove it (toggle off)
        await existingReaction.deleteOne();
        action = 'removed';
        
        // Decrement like count
        if (threadId) {
          await Thread.findByIdAndUpdate(threadId, { $inc: { likeCount: -1 } });
        } else {
          await Comment.findByIdAndUpdate(commentId, { $inc: { likeCount: -1 } });
        }
      } else {
        // Different reaction - update it
        existingReaction.type = type;
        await existingReaction.save();
        action = 'changed';
      }
    } else {
      // New reaction
      const reaction = new Reaction({
        user: forumUser._id,
        type,
        ...(threadId ? { thread: threadId } : { comment: commentId }),
      });
      await reaction.save();
      action = 'added';
      
      // Increment like count
      if (threadId) {
        await Thread.findByIdAndUpdate(threadId, { $inc: { likeCount: 1 } });
      } else {
        await Comment.findByIdAndUpdate(commentId, { $inc: { likeCount: 1 } });
      }
      
      // Award reputation to content author
      const content = threadId 
        ? await Thread.findById(threadId)
        : await Comment.findById(commentId);
      
      if (content && content.author.toString() !== forumUser._id.toString()) {
        const repGain = type === 'helpful' ? 5 : 1;
        await ForumUser.findByIdAndUpdate(content.author, { 
          $inc: { reputation: repGain } 
        });
      }
    }
    
    return NextResponse.json({
      success: true,
      data: {
        action,
        type: action === 'removed' ? null : type,
      },
    });
  } catch (error) {
    console.error('Error toggling reaction:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to toggle reaction' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
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
    
    const forumUser = await ForumUser.findOne({ authId: user.id });
    if (!forumUser) {
      return NextResponse.json(
        { success: false, error: 'Please create a forum profile first' },
        { status: 400 }
      );
    }
    
    const { searchParams } = new URL(request.url);
    const threadId = searchParams.get('thread');
    const commentId = searchParams.get('comment');
    
    const reaction = await Reaction.findOneAndDelete({
      user: forumUser._id,
      ...(threadId ? { thread: threadId } : { comment: commentId }),
    });
    
    if (reaction) {
      // Decrement like count
      if (threadId) {
        await Thread.findByIdAndUpdate(threadId, { $inc: { likeCount: -1 } });
      } else if (commentId) {
        await Comment.findByIdAndUpdate(commentId, { $inc: { likeCount: -1 } });
      }
    }
    
    return NextResponse.json({
      success: true,
      data: { removed: !!reaction },
    });
  } catch (error) {
    console.error('Error removing reaction:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to remove reaction' },
      { status: 500 }
    );
  }
}
