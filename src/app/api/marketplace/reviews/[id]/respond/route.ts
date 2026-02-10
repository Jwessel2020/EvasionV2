import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { Review, Shop } from '@/models/marketplace';
import { ForumUser, Notification } from '@/models/forum';
import { createServerSupabaseClient } from '@/lib/supabase/server';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/marketplace/reviews/[id]/respond - Add seller response to review
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

    const review = await Review.findById(id);
    if (!review) {
      return NextResponse.json(
        { success: false, error: 'Review not found' },
        { status: 404 }
      );
    }

    // Check if user is the target of the review
    let canRespond = false;

    if (review.targetType === 'seller' && review.targetUser) {
      canRespond = review.targetUser.toString() === forumUser._id.toString();
    } else if (review.targetType === 'shop' && review.targetShop) {
      const shop = await Shop.findById(review.targetShop);
      if (shop) {
        canRespond = shop.owner.toString() === forumUser._id.toString() ||
          shop.staff.some(
            (s: { userId: { toString: () => string }; role: string }) =>
              s.userId.toString() === forumUser._id.toString() &&
              ['admin', 'manager'].includes(s.role)
          );
      }
    }

    if (!canRespond) {
      return NextResponse.json(
        { success: false, error: 'You do not have permission to respond to this review' },
        { status: 403 }
      );
    }

    // Check if already responded
    if (review.response) {
      return NextResponse.json(
        { success: false, error: 'You have already responded to this review' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { content } = body;

    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Response content is required' },
        { status: 400 }
      );
    }

    // Add response
    const updatedReview = await Review.findByIdAndUpdate(
      id,
      {
        response: {
          content: content.trim(),
          respondedAt: new Date(),
          respondedBy: forumUser._id,
        },
      },
      { new: true }
    );

    // Notify the reviewer
    await Notification.create({
      recipient: review.reviewer,
      type: 'review_response',
      message: `The seller responded to your review`,
      data: {
        reviewId: review._id,
        responderId: forumUser._id,
        responderUsername: forumUser.username,
        listingTitle: review.listingTitle,
        preview: content.substring(0, 100),
      },
    });

    return NextResponse.json({
      success: true,
      data: updatedReview,
    });
  } catch (error) {
    console.error('Error responding to review:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to respond to review' },
      { status: 500 }
    );
  }
}
