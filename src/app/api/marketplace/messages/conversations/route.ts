import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { Conversation, Message, Listing } from '@/models/marketplace';
import { ForumUser, Notification } from '@/models/forum';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * GET /api/marketplace/messages/conversations - Get user's conversations
 * POST /api/marketplace/messages/conversations - Start a new conversation
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
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
    const skip = (page - 1) * limit;
    const status = searchParams.get('status'); // 'active', 'archived'

    // Build query
    const query: Record<string, unknown> = {
      'participants.userId': forumUser._id,
    };

    if (status) {
      query.status = status;
    } else {
      query.status = { $ne: 'deleted' };
    }

    const [conversations, total] = await Promise.all([
      Conversation.find(query)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Conversation.countDocuments(query),
    ]);

    // Get other participant info and listing details
    const enrichedConversations = await Promise.all(
      conversations.map(async (conv) => {
        // Find other participant
        const otherParticipantId = conv.participants.find(
          (p: { toString: () => string }) => p.toString() !== forumUser._id.toString()
        );

        const otherUser = otherParticipantId
          ? await ForumUser.findById(otherParticipantId)
            .select('username displayName avatar')
            .lean()
          : null;

        // Get listing info if attached
        let listing = null;
        if (conv.listing) {
          listing = await Listing.findById(conv.listing)
            .select('title slug price images status')
            .lean();
        }

        // Get unread count - stored at conversation level per participant
        const unreadCount = 0; // TODO: implement unread tracking

        return {
          ...conv,
          otherUser,
          listing,
          unreadCount,
        };
      })
    );

    // Get total unread count
    const totalUnread = await Conversation.aggregate([
      {
        $match: {
          'participants.userId': forumUser._id,
          status: { $ne: 'deleted' },
        },
      },
      { $unwind: '$participants' },
      { $match: { 'participants.userId': forumUser._id } },
      { $group: { _id: null, total: { $sum: '$participants.unreadCount' } } },
    ]);

    return NextResponse.json({
      success: true,
      data: enrichedConversations,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      totalUnread: totalUnread[0]?.total || 0,
    });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch conversations' },
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
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    if (forumUser.isBanned) {
      return NextResponse.json(
        { success: false, error: 'Your account is banned' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { recipientId, listingId, message } = body;

    if (!recipientId || !message) {
      return NextResponse.json(
        { success: false, error: 'Recipient and message are required' },
        { status: 400 }
      );
    }

    // Get recipient
    const recipient = await ForumUser.findById(recipientId);
    if (!recipient) {
      return NextResponse.json(
        { success: false, error: 'Recipient not found' },
        { status: 404 }
      );
    }

    // Can't message yourself
    if (recipient._id.toString() === forumUser._id.toString()) {
      return NextResponse.json(
        { success: false, error: 'You cannot message yourself' },
        { status: 400 }
      );
    }

    // Check if conversation already exists for this listing
    let conversation = null;
    if (listingId) {
      conversation = await Conversation.findOne({
        listing: listingId,
        'participants.userId': { $all: [forumUser._id, recipient._id] },
        status: { $ne: 'deleted' },
      });
    } else {
      // Check for existing non-listing conversation
      conversation = await Conversation.findOne({
        listing: { $exists: false },
        'participants.userId': { $all: [forumUser._id, recipient._id] },
        $expr: { $eq: [{ $size: '$participants' }, 2] },
        status: { $ne: 'deleted' },
      });
    }

    // Get listing info if provided
    let listing = null;
    if (listingId) {
      listing = await Listing.findById(listingId);
      if (!listing) {
        return NextResponse.json(
          { success: false, error: 'Listing not found' },
          { status: 404 }
        );
      }
    }

    if (!conversation) {
      // Create new conversation
      conversation = new Conversation({
        participants: [forumUser._id, recipient._id],
        participantUsernames: [forumUser.username, recipient.username],
        participantAvatars: [forumUser.avatar || null, recipient.avatar || null],
        listing: listingId || undefined,
        listingTitle: listing?.title,
        listingImage: listing?.images[0]?.url,
        listingPrice: listing?.price,
      });
      await conversation.save();
    }

    // Create message
    const newMessage = new Message({
      conversation: conversation._id,
      sender: forumUser._id,
      senderUsername: forumUser.username,
      senderAvatar: forumUser.avatar,
      content: message,
    });
    await newMessage.save();

    // Update conversation
    await Conversation.findByIdAndUpdate(conversation._id, {
      lastMessage: {
        content: message.substring(0, 100),
        senderId: forumUser._id,
        senderUsername: forumUser.username,
        sentAt: new Date(),
        isOffer: false,
      },
      $inc: { messageCount: 1 },
    });

    // Update listing inquiry count
    if (listing) {
      await Listing.findByIdAndUpdate(listingId, { $inc: { inquiryCount: 1 } });
    }

    // Notify recipient
    await Notification.create({
      recipient: recipient._id,
      type: 'new_message',
      message: listing
        ? `${forumUser.username} messaged you about "${listing.title}"`
        : `${forumUser.username} sent you a message`,
      data: {
        conversationId: conversation._id,
        senderId: forumUser._id,
        senderUsername: forumUser.username,
        senderAvatar: forumUser.avatar,
        listingId: listing?._id,
        listingTitle: listing?.title,
        preview: message.substring(0, 100),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        conversation,
        message: newMessage,
      },
    });
  } catch (error) {
    console.error('Error starting conversation:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to start conversation' },
      { status: 500 }
    );
  }
}
