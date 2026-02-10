import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { Listing, Shop, SavedListing, Order } from '@/models/marketplace';
import { ForumUser, Notification } from '@/models/forum';
import { createServerSupabaseClient } from '@/lib/supabase/server';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/marketplace/listings/[id]/mark-sold - Mark a listing as sold
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

    const listing = await Listing.findById(id);
    if (!listing) {
      return NextResponse.json(
        { success: false, error: 'Listing not found' },
        { status: 404 }
      );
    }

    // Check ownership
    const isOwner = listing.seller.toString() === forumUser._id.toString();
    let isShopStaff = false;

    if (listing.shop) {
      const shop = await Shop.findById(listing.shop);
      if (shop) {
        isShopStaff = shop.owner.toString() === forumUser._id.toString() ||
          shop.staff.some((s: { userId: { toString: () => string } }) =>
            s.userId.toString() === forumUser._id.toString()
          );
      }
    }

    if (!isOwner && !isShopStaff) {
      return NextResponse.json(
        { success: false, error: 'You do not have permission to update this listing' },
        { status: 403 }
      );
    }

    // Check if listing is active
    if (listing.status !== 'active') {
      return NextResponse.json(
        { success: false, error: 'Only active listings can be marked as sold' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { soldPrice, buyerUsername, createOrder = false } = body;

    // Mark as sold
    const updates: Record<string, unknown> = {
      status: 'sold',
      soldAt: new Date(),
      soldPrice: soldPrice || listing.price,
    };

    // If buyer specified, find them
    if (buyerUsername) {
      const buyer = await ForumUser.findOne({ username: buyerUsername });
      if (buyer) {
        updates.soldTo = buyer._id;

        // Create order record if requested
        if (createOrder) {
          const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

          await Order.create({
            orderNumber,
            buyer: buyer._id,
            buyerUsername: buyer.username,
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
            quantity: listing.quantity,
            agreedPrice: soldPrice || listing.price,
            currency: listing.currency,
            status: 'completed',
            statusHistory: [
              {
                status: 'completed',
                timestamp: new Date(),
                note: 'Order created from marked-as-sold listing',
              },
            ],
          });
        }
      }
    }

    const updatedListing = await Listing.findByIdAndUpdate(id, updates, { new: true });

    // Update shop stats
    if (listing.shop) {
      await Shop.findByIdAndUpdate(listing.shop, {
        $inc: {
          activeListings: -1,
          soldCount: 1,
          totalSales: soldPrice || listing.price
        },
      });
    }

    // Notify users who saved this listing
    const savedBy = await SavedListing.find({ listing: id });

    for (const saved of savedBy) {
      if (saved.user && saved.user.toString() !== forumUser._id.toString()) {
        await Notification.create({
          recipient: saved.user,
          type: 'listing_sold',
          message: `"${listing.title}" has been sold`,
          data: {
            listingId: listing._id,
            listingTitle: listing.title,
            listingImage: listing.images[0]?.url,
          },
        });
      }
    }

    // Clean up saved listings
    await SavedListing.deleteMany({ listing: id });

    return NextResponse.json({
      success: true,
      data: updatedListing,
      message: 'Listing marked as sold',
    });
  } catch (error) {
    console.error('Error marking listing as sold:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to mark listing as sold' },
      { status: 500 }
    );
  }
}
