import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { Conversation, Message } from '@/models/marketplace';
import { ForumUser, Notification } from '@/models/forum';
import { createServerSupabaseClient } from '@/lib/supabase/server';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/marketplace/messages/conversations/[id]/messages - Send a message
 */

export async function POST(request: NextRequest, { params }: RouteParams) {
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

    if (forumUser.isBanned) {
      return NextResponse.json(
        { success: false, error: 'Your account is banned' },
        { status: 403 }
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
    const { content, attachments = [], offer } = body;

    if (!content && attachments.length === 0 && !offer) {
      return NextResponse.json(
        { success: false, error: 'Message content is required' },
        { status: 400 }
      );
    }

    // Create message
    const message = new Message({
      conversation: id,
      sender: forumUser._id,
      senderUsername: forumUser.username,
      senderAvatar: forumUser.avatar,
      content: content || (offer ? `Made an offer: $${offer.amount}` : 'Sent an attachment'),
      attachments,
      offer: offer ? {
        amount: offer.amount,
        message: offer.message,
        status: 'pending',
      } : undefined,
      messageType: offer ? 'offer' : 'text',
    });

    await message.save();

    // Update conversation
    await Conversation.findByIdAndUpdate(id, {
      lastMessage: {
        content: (content || 'Sent an attachment').substring(0, 100),
        sender: forumUser._id,
        sentAt: new Date(),
      },
      activeOffer: offer ? {
        messageId: message._id,
        amount: offer.amount,
        status: 'pending' as const,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      } : conversation.activeOffer,
      $inc: { messageCount: 1, 'participants.$[other].unreadCount': 1 },
    }, {
      arrayFilters: [{ 'other.userId': { $ne: forumUser._id } }],
    });

    // Notify other participants
    const otherParticipantIds = conversation.participants.filter(
      (p: { toString: () => string }) => p.toString() !== forumUser._id.toString()
    );

    for (const participantId of otherParticipantIds) {
      await Notification.create({
        recipient: participantId,
        type: offer ? 'offer_received' : 'new_message',
        message: offer
          ? `${forumUser.username} made an offer of $${offer.amount}`
          : `New message from ${forumUser.username}`,
        data: {
          conversationId: id,
          messageId: message._id,
          senderId: forumUser._id,
          senderUsername: forumUser.username,
          senderAvatar: forumUser.avatar,
          listingId: conversation.listing,
          listingTitle: conversation.listingTitle,
          offerAmount: offer?.amount,
          preview: (content || '').substring(0, 100),
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: message,
    });
  } catch (error) {
    console.error('Error sending message:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to send message' },
      { status: 500 }
    );
  }
}
