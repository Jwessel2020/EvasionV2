import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { Group, ForumUser, Notification } from '@/models/forum';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * POST /api/forum/groups/[slug]/join - Join or request to join a group
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
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
    
    const { slug } = await params;
    
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
    
    const group = await Group.findOne({ slug, isArchived: false });
    if (!group) {
      return NextResponse.json(
        { success: false, error: 'Group not found' },
        { status: 404 }
      );
    }
    
    // Check if already a member
    const existingMember = group.members?.find(
      (m: { userId: { toString: () => string } }) => 
        m.userId.toString() === forumUser._id.toString()
    );
    
    if (existingMember) {
      return NextResponse.json(
        { success: false, error: 'You are already a member of this group' },
        { status: 400 }
      );
    }
    
    // Check if there's a pending request
    const pendingRequest = group.pendingRequests?.find(
      (r: { userId: { toString: () => string } }) => 
        r.userId.toString() === forumUser._id.toString()
    );
    
    if (pendingRequest) {
      return NextResponse.json(
        { success: false, error: 'You already have a pending join request' },
        { status: 400 }
      );
    }
    
    // Handle based on group type
    if (group.type === 'public') {
      // Direct join
      group.members.push({
        userId: forumUser._id,
        role: 'member',
        joinedAt: new Date(),
      });
      group.memberCount += 1;
      await group.save();
      
      // Update user's following count
      forumUser.followingCount += 1;
      await forumUser.save();
      
      return NextResponse.json({
        success: true,
        message: 'Successfully joined the group',
        data: { status: 'joined' },
      });
    } else if (group.type === 'private') {
      // Create join request
      if (!group.pendingRequests) {
        group.pendingRequests = [];
      }
      
      group.pendingRequests.push({
        userId: forumUser._id,
        requestedAt: new Date(),
        message: '',
      });
      await group.save();
      
      // Notify group admins
      const admins = group.members?.filter(
        (m: { role: string }) => ['owner', 'admin', 'moderator'].includes(m.role)
      ) || [];
      
      for (const admin of admins) {
        await Notification.create({
          recipient: admin.userId,
          type: 'group_invite',
          actor: forumUser._id,
          actorUsername: forumUser.username,
          actorAvatar: forumUser.avatar,
          group: group._id,
          groupName: group.name,
          message: `${forumUser.username} wants to join ${group.name}`,
          data: {
            requesterId: forumUser._id,
          },
        });
      }
      
      return NextResponse.json({
        success: true,
        message: 'Join request sent',
        data: { status: 'pending' },
      });
    } else {
      // Secret groups require invite
      return NextResponse.json(
        { success: false, error: 'This group is invite-only' },
        { status: 403 }
      );
    }
  } catch (error) {
    console.error('Error joining group:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to join group' },
      { status: 500 }
    );
  }
}
