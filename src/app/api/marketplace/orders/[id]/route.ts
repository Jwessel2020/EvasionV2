import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { Order, Listing, Shop } from '@/models/marketplace';
import { ForumUser, Notification } from '@/models/forum';
import { createServerSupabaseClient } from '@/lib/supabase/server';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/marketplace/orders/[id] - Get order details
 * PATCH /api/marketplace/orders/[id] - Update order status
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

    // Try to find by ID or order number
    let order = await Order.findById(id).lean();
    if (!order) {
      order = await Order.findOne({ orderNumber: id }).lean();
    }

    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    // Check if user is buyer, seller, or admin
    const isBuyer = order.buyer.toString() === forumUser._id.toString();
    const isSeller = order.seller.toString() === forumUser._id.toString();
    const isAdmin = forumUser.role === 'admin';

    if (!isBuyer && !isSeller && !isAdmin) {
      return NextResponse.json(
        { success: false, error: 'You do not have permission to view this order' },
        { status: 403 }
      );
    }

    // Get buyer and seller info
    const [buyer, seller] = await Promise.all([
      ForumUser.findById(order.buyer).select('username displayName avatar reputation').lean(),
      ForumUser.findById(order.seller).select('username displayName avatar reputation').lean(),
    ]);

    // Get listing info if it still exists
    const listing = await Listing.findById(order.listing)
      .select('title slug images status')
      .lean();

    return NextResponse.json({
      success: true,
      data: {
        ...order,
        buyer,
        seller,
        listing,
        isBuyer,
        isSeller,
      },
    });
  } catch (error) {
    console.error('Error fetching order:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch order' },
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

    const order = await Order.findById(id);
    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    // Check permissions
    const isBuyer = order.buyer.toString() === forumUser._id.toString();
    const isSeller = order.seller.toString() === forumUser._id.toString();
    const isAdmin = forumUser.role === 'admin';

    if (!isBuyer && !isSeller && !isAdmin) {
      return NextResponse.json(
        { success: false, error: 'You do not have permission to update this order' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { status, trackingNumber, trackingCarrier, notes } = body;

    // Status transition rules
    const sellerStatuses = ['confirmed', 'paid', 'shipped', 'completed', 'cancelled'];
    const buyerStatuses = ['delivered', 'disputed', 'cancelled'];

    if (status) {
      // Validate status transition
      const validTransitions: Record<string, string[]> = {
        pending: ['confirmed', 'cancelled'],
        confirmed: ['paid', 'cancelled'],
        paid: ['shipped', 'cancelled'],
        shipped: ['delivered'],
        delivered: ['completed', 'disputed'],
        completed: [],
        cancelled: [],
        disputed: ['completed', 'cancelled'],
      };

      if (!validTransitions[order.status]?.includes(status)) {
        return NextResponse.json(
          { success: false, error: `Cannot transition from ${order.status} to ${status}` },
          { status: 400 }
        );
      }

      // Check role permissions for status change
      if (sellerStatuses.includes(status) && !isSeller && !isAdmin) {
        return NextResponse.json(
          { success: false, error: 'Only the seller can update to this status' },
          { status: 403 }
        );
      }

      if (buyerStatuses.includes(status) && !isBuyer && !isAdmin) {
        return NextResponse.json(
          { success: false, error: 'Only the buyer can update to this status' },
          { status: 403 }
        );
      }
    }

    // Build update
    const updates: Record<string, unknown> = {};

    if (status) {
      updates.status = status;
      updates.$push = {
        statusHistory: {
          status,
          timestamp: new Date(),
          note: notes || `Status changed to ${status}`,
          updatedBy: forumUser._id,
        },
      };

      // Handle specific status changes
      if (status === 'shipped') {
        if (trackingNumber) {
          updates.trackingNumber = trackingNumber;
          updates.trackingCarrier = trackingCarrier;
        }
        updates.shippedAt = new Date();
      } else if (status === 'delivered') {
        updates.deliveredAt = new Date();
      } else if (status === 'completed') {
        updates.completedAt = new Date();

        // Update listing as sold
        if (order.listing) {
          await Listing.findByIdAndUpdate(order.listing, {
            status: 'sold',
            soldAt: new Date(),
            soldTo: order.buyer,
            soldPrice: order.agreedPrice,
          });

          // Update shop stats
          if (order.shop) {
            await Shop.findByIdAndUpdate(order.shop, {
              $inc: { soldCount: 1, totalSales: order.agreedPrice, activeListings: -1 },
            });
          }
        }
      } else if (status === 'cancelled') {
        updates.cancelledAt = new Date();
        updates.cancelledBy = forumUser._id;
        updates.cancellationReason = notes;
      }
    }

    // Update tracking info without status change
    if (!status && trackingNumber) {
      updates.trackingNumber = trackingNumber;
      updates.trackingCarrier = trackingCarrier;
    }

    const updatedOrder = await Order.findByIdAndUpdate(
      id,
      updates,
      { new: true }
    );

    // Notify the other party
    const notifyUserId = isSeller ? order.buyer : order.seller;
    if (status) {
      await Notification.create({
        recipient: notifyUserId,
        type: 'order_status',
        message: `Order #${order.orderNumber} is now ${status}`,
        data: {
          orderId: order._id,
          orderNumber: order.orderNumber,
          status,
          listingTitle: order.itemSnapshot.title,
          listingImage: order.itemSnapshot.image,
          trackingNumber,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: updatedOrder,
    });
  } catch (error) {
    console.error('Error updating order:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update order' },
      { status: 500 }
    );
  }
}
