import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { Order, Listing, Shop } from '@/models/marketplace';
import { ForumUser, Notification } from '@/models/forum';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * GET /api/marketplace/orders - Get user's orders (as buyer or seller)
 * POST /api/marketplace/orders - Create a new order
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
    const role = searchParams.get('role') || 'buyer'; // 'buyer' or 'seller'
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
    const skip = (page - 1) * limit;

    // Build query
    const query: Record<string, unknown> = {};

    if (role === 'seller') {
      query.seller = forumUser._id;
    } else {
      query.buyer = forumUser._id;
    }

    if (status) {
      query.status = status;
    }

    const [orders, total] = await Promise.all([
      Order.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Order.countDocuments(query),
    ]);

    // Get additional info for each order
    const enrichedOrders = await Promise.all(
      orders.map(async (order) => {
        // Get the other party's info
        const otherPartyId = role === 'seller' ? order.buyer : order.seller;
        const otherParty = await ForumUser.findById(otherPartyId)
          .select('username avatar')
          .lean();

        return {
          ...order,
          otherParty,
        };
      })
    );

    // Get stats
    const stats = await Order.aggregate([
      { $match: { [role === 'seller' ? 'seller' : 'buyer']: forumUser._id } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    const statsMap = Object.fromEntries(stats.map((s) => [s._id, s.count]));

    return NextResponse.json({
      success: true,
      data: enrichedOrders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      stats: {
        pending: statsMap.pending || 0,
        confirmed: statsMap.confirmed || 0,
        paid: statsMap.paid || 0,
        shipped: statsMap.shipped || 0,
        delivered: statsMap.delivered || 0,
        completed: statsMap.completed || 0,
        cancelled: statsMap.cancelled || 0,
        disputed: statsMap.disputed || 0,
      },
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch orders' },
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
      listingId,
      agreedPrice,
      quantity = 1,
      paymentMethod,
      shippingAddress,
      notes,
    } = body;

    if (!listingId || !agreedPrice) {
      return NextResponse.json(
        { success: false, error: 'Listing and agreed price are required' },
        { status: 400 }
      );
    }

    // Get listing
    const listing = await Listing.findById(listingId);
    if (!listing) {
      return NextResponse.json(
        { success: false, error: 'Listing not found' },
        { status: 404 }
      );
    }

    if (listing.status !== 'active') {
      return NextResponse.json(
        { success: false, error: 'This listing is no longer available' },
        { status: 400 }
      );
    }

    // Can't buy from yourself
    if (listing.seller.toString() === forumUser._id.toString()) {
      return NextResponse.json(
        { success: false, error: 'You cannot buy your own listing' },
        { status: 400 }
      );
    }

    // Generate order number
    const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    // Get seller info
    const seller = await ForumUser.findById(listing.seller);

    // Create order
    const order = new Order({
      orderNumber,
      buyer: forumUser._id,
      buyerUsername: forumUser.username,
      seller: listing.seller,
      sellerUsername: listing.sellerUsername,
      shop: listing.shop,
      shopName: listing.shopName,
      listing: listing._id,
      itemSnapshot: {
        title: listing.title,
        image: listing.images[0]?.url,
        condition: listing.condition,
        category: listing.category,
      },
      quantity,
      agreedPrice,
      currency: listing.currency,
      paymentMethod,
      shippingAddress,
      notes,
      status: 'pending',
      statusHistory: [
        {
          status: 'pending',
          timestamp: new Date(),
          note: 'Order created',
        },
      ],
    });

    await order.save();

    // Notify seller
    await Notification.create({
      recipient: listing.seller,
      type: 'order_created',
      message: `New order for "${listing.title}" from ${forumUser.username}`,
      data: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        buyerId: forumUser._id,
        buyerUsername: forumUser.username,
        listingId: listing._id,
        listingTitle: listing.title,
        listingImage: listing.images[0]?.url,
        amount: agreedPrice,
      },
    });

    return NextResponse.json({
      success: true,
      data: order,
    });
  } catch (error) {
    console.error('Error creating order:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create order' },
      { status: 500 }
    );
  }
}
