import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { Group, ForumUser } from '@/models/forum';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * GET /api/forum/groups/[slug] - Get a single group by slug
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    await connectDB();
    
    const { slug } = await params;
    
    const group = await Group.findOne({ slug, isArchived: false })
      .populate('createdBy', 'username avatar')
      .populate('members.userId', 'username avatar')
      .lean();
    
    if (!group) {
      return NextResponse.json(
        { success: false, error: 'Group not found' },
        { status: 404 }
      );
    }
    
    // Check if group is secret and user is not a member
    if (group.type === 'secret') {
      const supabase = await createServerSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const forumUser = await ForumUser.findOne({ authId: user.id });
        const isMember = forumUser && group.members?.some(
          (m: { userId: { _id: { toString: () => string } } }) => 
            m.userId._id.toString() === forumUser._id.toString()
        );
        
        if (!isMember) {
          return NextResponse.json(
            { success: false, error: 'Group not found' },
            { status: 404 }
          );
        }
      } else {
        return NextResponse.json(
          { success: false, error: 'Group not found' },
          { status: 404 }
        );
      }
    }
    
    return NextResponse.json({
      success: true,
      data: group,
    });
  } catch (error) {
    console.error('Error fetching group:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch group' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/forum/groups/[slug] - Update a group (admin/owner only)
 */
export async function PATCH(
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
    
    // Check if user is owner or admin
    const memberRecord = group.members?.find(
      (m: { userId: { toString: () => string }; role: string }) => 
        m.userId.toString() === forumUser._id.toString()
    );
    
    if (!memberRecord || !['owner', 'admin'].includes(memberRecord.role)) {
      return NextResponse.json(
        { success: false, error: 'You do not have permission to edit this group' },
        { status: 403 }
      );
    }
    
    const body = await request.json();
    const allowedFields = [
      'name', 'description', 'shortDescription', 'avatar', 'banner',
      'type', 'category', 'tags', 'location', 'rules', 'settings'
    ];
    
    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }
    
    // Handle slug change if name changes
    if (body.name && body.name !== group.name) {
      const baseSlug = body.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      
      let newSlug = baseSlug;
      let counter = 1;
      while (await Group.findOne({ slug: newSlug, _id: { $ne: group._id } })) {
        newSlug = `${baseSlug}-${counter}`;
        counter++;
      }
      updates.slug = newSlug;
    }
    
    const updatedGroup = await Group.findByIdAndUpdate(
      group._id,
      { $set: updates },
      { new: true }
    ).populate('createdBy', 'username avatar');
    
    return NextResponse.json({
      success: true,
      data: updatedGroup,
    });
  } catch (error) {
    console.error('Error updating group:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update group' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/forum/groups/[slug] - Archive a group (owner only)
 */
export async function DELETE(
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
    
    // Check if user is owner
    const memberRecord = group.members?.find(
      (m: { userId: { toString: () => string }; role: string }) => 
        m.userId.toString() === forumUser._id.toString()
    );
    
    if (!memberRecord || memberRecord.role !== 'owner') {
      return NextResponse.json(
        { success: false, error: 'Only the group owner can delete this group' },
        { status: 403 }
      );
    }
    
    // Soft delete (archive)
    group.isArchived = true;
    await group.save();
    
    return NextResponse.json({
      success: true,
      message: 'Group deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting group:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete group' },
      { status: 500 }
    );
  }
}
