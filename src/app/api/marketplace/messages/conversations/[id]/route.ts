import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { Conversation, Message, Listing } from '@/models/marketplace';
import { ForumUser } from '@/models/forum';
import { createServerSupabaseClient } from '@/lib/supabase/server';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/marketplace/messages/conversations/[id] - Get conversation messages
 * PATCH /api/marketplace/messages/conversations/[id] - Update conversation (archive, etc.)
 */

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
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
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const conversation = await Conversation.findById(id);
    if (!conversation) {
      return NextResponse.json(
        { success: false, error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Check if user is participant
    const isParticipant = conversation.participants.some(
      (p: { toString: () => string }) => p.toString() === forumUser._id.toString()
    );

    if (!isParticipant) {
      return NextResponse.json(
        { success: false, error: 'You are not a participant in this conversation' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const skip = (page - 1) * limit;

    // Get messages
    const [messages, total] = await Promise.all([
      Message.find({ conversation: id, isDeleted: false })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Message.countDocuments({ conversation: id, isDeleted: false }),
    ]);

    // Get other participant info
    const otherParticipantId = conversation.participants.find(
      (p: { toString: () => string }) => p.toString() !== forumUser._id.toString()
    );

    const otherUser = otherParticipantId
      ? await ForumUser.findById(otherParticipantId)
        .select('username displayName avatar reputation lastActiveAt')
        .lean()
      : null;

    // Get listing info if attached
    let listing = null;
    if (conversation.listing) {
      listing = await Listing.findById(conversation.listing)
        .select('title slug price originalPrice condition images status sellerUsername')
        .lean();
    }

    // Mark messages as read
    await Message.updateMany(
      {
        conversation: id,
        sender: { $ne: forumUser._id },
        isRead: false,
      },
      { isRead: true, readAt: new Date() }
    );

    // Reset unread count for current user
    await Conversation.findByIdAndUpdate(id, {
      $set: { 'participants.$[self].unreadCount': 0 },
    }, {
      arrayFilters: [{ 'self.userId': forumUser._id }],
    });

    return NextResponse.json({
      success: true,
      data: {
        conversation,
        messages: messages.reverse(), // Return in chronological order
        otherUser,
        listing,
      },
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching conversation:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch conversation' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
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
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const conversation = await Conversation.findById(id);
    if (!conversation) {
      return NextResponse.json(
        { success: false, error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Check if user is participant
    const isParticipant = conversation.participants.some(
      (p: { toString: () => string }) => p.toString() === forumUser._id.toString()
    );

    if (!isParticipant) {
      return NextResponse.json(
        { success: false, error: 'You are not a participant in this conversation' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { action } = body;

    if (action === 'archive') {
      await Conversation.findByIdAndUpdate(id, { status: 'archived' });
    } else if (action === 'unarchive') {
      await Conversation.findByIdAndUpdate(id, { status: 'active' });
    } else if (action === 'delete') {
      // Soft delete - only hide from this user
      await Conversation.findByIdAndUpdate(id, {
        $set: { 'participants.$[self].deleted': true },
      }, {
        arrayFilters: [{ 'self.userId': forumUser._id }],
      });
    } else if (action === 'markRead') {
      await Message.updateMany(
        { conversation: id, sender: { $ne: forumUser._id } },
        { isRead: true, readAt: new Date() }
      );
      await Conversation.findByIdAndUpdate(id, {
        $set: { 'participants.$[self].unreadCount': 0 },
      }, {
        arrayFilters: [{ 'self.userId': forumUser._id }],
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Conversation updated',
    });
  } catch (error) {
    console.error('Error updating conversation:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update conversation' },
      { status: 500 }
    );
  }
}
