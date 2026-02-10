import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import { Review, Order, Shop, Listing } from '@/models/marketplace';
import { ForumUser, Notification } from '@/models/forum';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * GET /api/marketplace/reviews - Get reviews for a seller, shop, or buyer
 * POST /api/marketplace/reviews - Create a new review
 */

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const sellerId = searchParams.get('seller');
    const shopId = searchParams.get('shop');
    const shopSlug = searchParams.get('shopSlug');
    const buyerId = searchParams.get('buyer');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
    const skip = (page - 1) * limit;

    // Build query
    const query: Record<string, unknown> = {};

    if (sellerId) {
      query.targetId = sellerId;
      query.targetType = 'seller';
    } else if (shopId) {
      query.targetId = shopId;
      query.targetType = 'shop';
    } else if (shopSlug) {
      const shop = await Shop.findOne({ slug: shopSlug });
      if (shop) {
        query.targetId = shop._id;
        query.targetType = 'shop';
      }
    } else if (buyerId) {
      query.targetId = buyerId;
      query.targetType = 'buyer';
    } else {
      return NextResponse.json(
        { success: false, error: 'Seller, shop, or buyer ID is required' },
        { status: 400 }
      );
    }

    const [reviews, total] = await Promise.all([
      Review.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Review.countDocuments(query),
    ]);

    // Get reviewer info
    const enrichedReviews = await Promise.all(
      reviews.map(async (review) => {
        const reviewer = await ForumUser.findById(review.reviewer)
          .select('username displayName avatar')
          .lean();

        return {
          ...review,
          reviewer,
        };
      })
    );

    // Calculate rating breakdown
    const ratingBreakdown = await Review.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$ratings.overall',
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: -1 } },
    ]);

    const breakdown = Object.fromEntries(
      [5, 4, 3, 2, 1].map((r) => [
        r,
        ratingBreakdown.find((b) => b._id === r)?.count || 0,
      ])
    );

    // Calculate averages
    const avgRatings = await Review.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          overall: { $avg: '$ratings.overall' },
          itemAsDescribed: { $avg: '$ratings.itemAsDescribed' },
          communication: { $avg: '$ratings.communication' },
          shippingSpeed: { $avg: '$ratings.shippingSpeed' },
          count: { $sum: 1 },
        },
      },
    ]);

    return NextResponse.json({
      success: true,
      data: enrichedReviews,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      stats: {
        averageRating: avgRatings[0]?.overall || 0,
        averageItemAsDescribed: avgRatings[0]?.itemAsDescribed || 0,
        averageCommunication: avgRatings[0]?.communication || 0,
        averageShippingSpeed: avgRatings[0]?.shippingSpeed || 0,
        totalReviews: avgRatings[0]?.count || 0,
        breakdown,
      },
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch reviews' },
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

    const body = await request.json();
    const {
      orderId,
      targetType, // 'seller', 'shop', or 'buyer'
      ratings,
      content,
      photos = [],
    } = body;

    if (!orderId || !targetType || !ratings) {
      return NextResponse.json(
        { success: false, error: 'Order ID, target type, and ratings are required' },
        { status: 400 }
      );
    }

    // Validate ratings
    if (!ratings.overall || ratings.overall < 1 || ratings.overall > 5) {
      return NextResponse.json(
        { success: false, error: 'Overall rating must be between 1 and 5' },
        { status: 400 }
      );
    }

    // Get order
    const order = await Order.findById(orderId);
    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    // Check order status - only completed orders can be reviewed
    if (order.status !== 'completed') {
      return NextResponse.json(
        { success: false, error: 'Can only review completed orders' },
        { status: 400 }
      );
    }

    // Determine target and verify permissions
    let targetUser: mongoose.Types.ObjectId | null = null;
    let targetShop: mongoose.Types.ObjectId | null = null;
    let targetUsername: string | null = null;
    let targetShopName: string | null = null;
    let isVerifiedPurchase = false;

    if (targetType === 'seller' || targetType === 'shop') {
      // Buyer reviewing seller/shop
      if (order.buyer.toString() !== forumUser._id.toString()) {
        return NextResponse.json(
          { success: false, error: 'Only the buyer can review the seller' },
          { status: 403 }
        );
      }
      if (targetType === 'shop' && order.shop) {
        targetShop = order.shop;
        const shop = await Shop.findById(order.shop);
        targetShopName = shop?.name || null;
      } else {
        targetUser = order.seller;
        const seller = await ForumUser.findById(order.seller);
        targetUsername = seller?.username || null;
      }
      isVerifiedPurchase = true;
    } else if (targetType === 'buyer') {
      // Seller reviewing buyer
      if (order.seller.toString() !== forumUser._id.toString()) {
        return NextResponse.json(
          { success: false, error: 'Only the seller can review the buyer' },
          { status: 403 }
        );
      }
      targetUser = order.buyer;
      const buyer = await ForumUser.findById(order.buyer);
      targetUsername = buyer?.username || null;
      isVerifiedPurchase = true;
    }

    // Check if already reviewed
    const existingReview = await Review.findOne({
      reviewer: forumUser._id,
      order: orderId,
      targetType,
    });

    if (existingReview) {
      return NextResponse.json(
        { success: false, error: 'You have already reviewed this order' },
        { status: 400 }
      );
    }

    // Create review
    const review = new Review({
      reviewer: forumUser._id,
      reviewerUsername: forumUser.username,
      reviewerAvatar: forumUser.avatar,
      targetType,
      targetUser: targetUser || undefined,
      targetUsername: targetUsername || undefined,
      targetShop: targetShop || undefined,
      targetShopName: targetShopName || undefined,
      order: orderId,
      listing: order.listing,
      listingTitle: order.itemSnapshot.title,
      rating: ratings.overall,
      ratings: {
        overall: ratings.overall,
        itemAsDescribed: ratings.itemAsDescribed || ratings.overall,
        communication: ratings.communication || ratings.overall,
        shippingSpeed: ratings.shippingSpeed || ratings.overall,
      },
      content,
      photos,
      isVerifiedPurchase,
    });

    await review.save();

    // Update target's average rating
    const matchQuery = targetType === 'shop'
      ? { targetShop, targetType }
      : { targetUser, targetType };

    const avgResult = await Review.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          avgRating: { $avg: '$ratings.overall' },
          count: { $sum: 1 },
        },
      },
    ]);

    const newAvgRating = avgResult[0]?.avgRating || ratings.overall;
    const reviewCount = avgResult[0]?.count || 1;

    if (targetType === 'shop' && targetShop) {
      await Shop.findByIdAndUpdate(targetShop, {
        averageRating: newAvgRating,
        reviewCount,
      });
    } else if (targetUser) {
      // Update user's marketplace reputation
      await ForumUser.findByIdAndUpdate(targetUser, {
        'marketplaceStats.averageRating': newAvgRating,
        'marketplaceStats.reviewCount': reviewCount,
      });
    }

    // Notify the reviewed party (only notify users, not shops)
    const recipientId = targetType === 'shop' && targetShop
      ? (await Shop.findById(targetShop))?.owner
      : targetUser;

    if (recipientId) {
      await Notification.create({
        recipient: recipientId,
        type: 'review_received',
        message: `${forumUser.username} left a ${ratings.overall}-star review`,
        data: {
          reviewId: review._id,
          reviewerId: forumUser._id,
          reviewerUsername: forumUser.username,
          reviewerAvatar: forumUser.avatar,
          rating: ratings.overall,
          orderId,
          listingTitle: order.itemSnapshot.title,
          preview: content?.substring(0, 100),
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: review,
    });
  } catch (error) {
    console.error('Error creating review:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create review' },
      { status: 500 }
    );
  }
}
