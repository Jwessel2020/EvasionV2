import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { Follow, ForumUser, Board, Group, Thread } from '@/models/forum';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * GET /api/forum/follows - Get follow status or list follows
 * POST /api/forum/follows - Follow/unfollow something
 */

export async function GET(request: NextRequest) {
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
    const targetType = searchParams.get('targetType');
    const targetId = searchParams.get('targetId');
    
    if (targetType && targetId) {
      // Check if following specific target
      const query: Record<string, unknown> = {
        follower: forumUser._id,
        targetType,
      };
      
      switch (targetType) {
        case 'user': query.targetUser = targetId; break;
        case 'board': query.targetBoard = targetId; break;
        case 'group': query.targetGroup = targetId; break;
        case 'thread': query.targetThread = targetId; break;
      }
      
      const follow = await Follow.findOne(query);
      
      return NextResponse.json({
        success: true,
        data: {
          isFollowing: !!follow,
          follow,
        },
      });
    }
    
    // List all follows
    const follows = await Follow.find({ follower: forumUser._id })
      .populate('targetUser', 'username displayName avatar')
      .populate('targetBoard', 'name slug color')
      .populate('targetGroup', 'name slug avatar')
      .populate('targetThread', 'title slug')
      .sort({ createdAt: -1 })
      .lean();
    
    return NextResponse.json({
      success: true,
      data: follows,
    });
  } catch (error) {
    console.error('Error fetching follows:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch follows' },
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
    const { targetType, targetId } = body;
    
    if (!targetType || !targetId) {
      return NextResponse.json(
        { success: false, error: 'Target type and ID are required' },
        { status: 400 }
      );
    }
    
    const validTypes = ['user', 'board', 'group', 'thread'];
    if (!validTypes.includes(targetType)) {
      return NextResponse.json(
        { success: false, error: 'Invalid target type' },
        { status: 400 }
      );
    }
    
    // Build query
    const query: Record<string, unknown> = {
      follower: forumUser._id,
      targetType,
    };
    
    const followData: Record<string, unknown> = {
      follower: forumUser._id,
      targetType,
    };
    
    switch (targetType) {
      case 'user':
        query.targetUser = targetId;
        followData.targetUser = targetId;
        // Can't follow yourself
        if (targetId === forumUser._id.toString()) {
          return NextResponse.json(
            { success: false, error: 'Cannot follow yourself' },
            { status: 400 }
          );
        }
        break;
      case 'board':
        query.targetBoard = targetId;
        followData.targetBoard = targetId;
        break;
      case 'group':
        query.targetGroup = targetId;
        followData.targetGroup = targetId;
        break;
      case 'thread':
        query.targetThread = targetId;
        followData.targetThread = targetId;
        break;
    }
    
    // Check if already following
    const existingFollow = await Follow.findOne(query);
    
    if (existingFollow) {
      // Unfollow
      await existingFollow.deleteOne();
      
      // Update counts
      forumUser.followingCount = Math.max(0, forumUser.followingCount - 1);
      await forumUser.save();
      
      // Update target's follower count
      switch (targetType) {
        case 'user':
          await ForumUser.findByIdAndUpdate(targetId, { $inc: { followerCount: -1 } });
          break;
        case 'board':
          await Board.findByIdAndUpdate(targetId, { $inc: { followerCount: -1 } });
          break;
        // Groups handle members differently
      }
      
      return NextResponse.json({
        success: true,
        data: {
          action: 'unfollowed',
          isFollowing: false,
        },
      });
    } else {
      // Follow
      const follow = new Follow(followData);
      await follow.save();
      
      // Update counts
      forumUser.followingCount += 1;
      await forumUser.save();
      
      // Update target's follower count
      switch (targetType) {
        case 'user':
          await ForumUser.findByIdAndUpdate(targetId, { $inc: { followerCount: 1 } });
          break;
        case 'board':
          await Board.findByIdAndUpdate(targetId, { $inc: { followerCount: 1 } });
          break;
      }
      
      return NextResponse.json({
        success: true,
        data: {
          action: 'followed',
          isFollowing: true,
        },
      });
    }
  } catch (error) {
    console.error('Error toggling follow:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to toggle follow' },
      { status: 500 }
    );
  }
}
