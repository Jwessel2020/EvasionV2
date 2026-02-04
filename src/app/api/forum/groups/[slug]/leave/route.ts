import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { Group, ForumUser } from '@/models/forum';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * POST /api/forum/groups/[slug]/leave - Leave a group
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
    
    const group = await Group.findOne({ slug, isArchived: false });
    if (!group) {
      return NextResponse.json(
        { success: false, error: 'Group not found' },
        { status: 404 }
      );
    }
    
    // Find member record
    const memberIndex = group.members?.findIndex(
      (m: { userId: { toString: () => string } }) => 
        m.userId.toString() === forumUser._id.toString()
    );
    
    if (memberIndex === undefined || memberIndex === -1) {
      return NextResponse.json(
        { success: false, error: 'You are not a member of this group' },
        { status: 400 }
      );
    }
    
    const memberRecord = group.members[memberIndex];
    
    // Owner cannot leave without transferring ownership
    if (memberRecord.role === 'owner') {
      // Check if there are other admins
      const otherAdmins = group.members.filter(
        (m: { userId: { toString: () => string }; role: string }) => 
          m.role === 'admin' && m.userId.toString() !== forumUser._id.toString()
      );
      
      if (otherAdmins.length === 0) {
        return NextResponse.json(
          { success: false, error: 'You must transfer ownership before leaving. You are the only admin.' },
          { status: 400 }
        );
      }
      
      // Auto-transfer ownership to first admin
      const newOwner = otherAdmins[0];
      const newOwnerIndex = group.members.findIndex(
        (m: { userId: { toString: () => string } }) => 
          m.userId.toString() === newOwner.userId.toString()
      );
      
      if (newOwnerIndex !== -1) {
        group.members[newOwnerIndex].role = 'owner';
      }
    }
    
    // Remove member
    group.members.splice(memberIndex, 1);
    group.memberCount = Math.max(0, group.memberCount - 1);
    await group.save();
    
    // Update user's following count
    forumUser.followingCount = Math.max(0, forumUser.followingCount - 1);
    await forumUser.save();
    
    return NextResponse.json({
      success: true,
      message: 'Successfully left the group',
    });
  } catch (error) {
    console.error('Error leaving group:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to leave group' },
      { status: 500 }
    );
  }
}
