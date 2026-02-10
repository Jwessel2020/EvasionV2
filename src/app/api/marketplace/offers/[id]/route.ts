import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { Conversation, Message, Listing } from '@/models/marketplace';
import { ForumUser, Notification } from '@/models/forum';
import { createServerSupabaseClient } from '@/lib/supabase/server';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/marketplace/offers/[id] - Respond to an offer (accept, reject, counter)
 */

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: messageId } = await params;
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

    // Get the message with the offer
    const message = await Message.findById(messageId);
    if (!message) {
      return NextResponse.json(
        { success: false, error: 'Offer not found' },
        { status: 404 }
      );
    }

    if (!message.offer) {
      return NextResponse.json(
        { success: false, error: 'This message is not an offer' },
        { status: 400 }
      );
    }

    if (message.offer.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: `This offer has already been ${message.offer.status}` },
        { status: 400 }
      );
    }

    // Get conversation
    const conversation = await Conversation.findById(message.conversation);
    if (!conversation) {
      return NextResponse.json(
        { success: false, error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Check if user is the recipient of the offer (not the sender)
    if (message.sender.toString() === forumUser._id.toString()) {
      return NextResponse.json(
        { success: false, error: 'You cannot respond to your own offer' },
        { status: 400 }
      );
    }

    // Verify user is a participant
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
    const { action, counterAmount, counterMessage } = body;

    if (!['accept', 'reject', 'counter'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Invalid action. Must be accept, reject, or counter' },
        { status: 400 }
      );
    }

    if (action === 'counter' && !counterAmount) {
      return NextResponse.json(
        { success: false, error: 'Counter amount is required' },
        { status: 400 }
      );
    }

    // Update the offer status
    const updateData: Record<string, unknown> = {
      'offer.status': action === 'counter' ? 'countered' : action + 'ed',
      'offer.respondedAt': new Date(),
      'offer.respondedBy': forumUser._id,
    };

    if (action === 'counter') {
      updateData['offer.counterAmount'] = counterAmount;
      updateData['offer.counterMessage'] = counterMessage;
    }

    await Message.findByIdAndUpdate(messageId, { $set: updateData });

    // Create response message
    let responseContent = '';
    if (action === 'accept') {
      responseContent = `Accepted the offer of $${message.offer.amount}`;
    } else if (action === 'reject') {
      responseContent = `Declined the offer of $${message.offer.amount}`;
    } else {
      responseContent = `Counter offer: $${counterAmount}${counterMessage ? ` - ${counterMessage}` : ''}`;
    }

    const responseMessage = new Message({
      conversation: conversation._id,
      sender: forumUser._id,
      senderUsername: forumUser.username,
      senderAvatar: forumUser.avatar,
      content: responseContent,
      messageType: action === 'counter' ? 'offer' : 'system',
      offer: action === 'counter' ? {
        amount: counterAmount,
        message: counterMessage,
        status: 'pending',
        originalOfferId: message._id,
      } : undefined,
    });

    await responseMessage.save();

    // Update conversation
    const activeOffer = action === 'counter' ? {
      messageId: responseMessage._id,
      amount: counterAmount,
      status: 'pending' as const,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    } : undefined;
    await Conversation.findByIdAndUpdate(conversation._id, {
      lastMessage: {
        content: responseContent.substring(0, 100),
        sender: forumUser._id,
        sentAt: new Date(),
      },
      activeOffer,
      $inc: { messageCount: 1, 'participants.$[other].unreadCount': 1 },
    }, {
      arrayFilters: [{ 'other.userId': { $ne: forumUser._id } }],
    });

    // Notify the original offerer
    let notificationType = 'offer_response';
    if (action === 'accept') notificationType = 'offer_accepted';
    else if (action === 'counter') notificationType = 'offer_countered';

    await Notification.create({
      recipient: message.sender,
      type: notificationType,
      message: action === 'accept'
        ? `${forumUser.username} accepted your offer of $${message.offer.amount}!`
        : action === 'counter'
        ? `${forumUser.username} countered with $${counterAmount}`
        : `${forumUser.username} declined your offer of $${message.offer.amount}`,
      data: {
        conversationId: conversation._id,
        messageId: responseMessage._id,
        senderId: forumUser._id,
        senderUsername: forumUser.username,
        listingId: conversation.listing,
        listingTitle: conversation.listingTitle,
        originalAmount: message.offer.amount,
        counterAmount: action === 'counter' ? counterAmount : undefined,
        action,
      },
    });

    // If accepted, update listing offer count
    if (action === 'accept' && conversation.listing) {
      await Listing.findByIdAndUpdate(conversation.listing, {
        $inc: { offerCount: 1 },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        message: responseMessage,
        action,
      },
    });
  } catch (error) {
    console.error('Error responding to offer:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to respond to offer' },
      { status: 500 }
    );
  }
}
