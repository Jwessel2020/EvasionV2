import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { Listing, Shop, SavedListing } from '@/models/marketplace';
import { ForumUser } from '@/models/forum';
import { createServerSupabaseClient } from '@/lib/supabase/server';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/marketplace/listings/[id] - Get a single listing
 * PATCH /api/marketplace/listings/[id] - Update a listing
 * DELETE /api/marketplace/listings/[id] - Delete a listing
 */

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    await connectDB();

    // Try to find by ID first, then by slug
    let listing = await Listing.findById(id).lean();

    if (!listing) {
      listing = await Listing.findOne({ slug: id }).lean();
    }

    if (!listing) {
      return NextResponse.json(
        { success: false, error: 'Listing not found' },
        { status: 404 }
      );
    }

    // Don't show removed listings
    if (listing.status === 'removed') {
      return NextResponse.json(
        { success: false, error: 'This listing has been removed' },
        { status: 404 }
      );
    }

    // Increment view count
    await Listing.findByIdAndUpdate(listing._id, { $inc: { viewCount: 1 } });

    // Check if current user has saved this listing
    let isSaved = false;
    try {
      const supabase = await createServerSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const forumUser = await ForumUser.findOne({ authId: user.id });
        if (forumUser) {
          const saved = await SavedListing.findOne({
            user: forumUser._id,
            listing: listing._id,
          });
          isSaved = !!saved;
        }
      }
    } catch {
      // Ignore auth errors for public viewing
    }

    // Get seller info
    const seller = await ForumUser.findById(listing.seller)
      .select('username displayName avatar reputation location createdAt')
      .lean();

    // Get shop info if applicable
    let shop = null;
    if (listing.shop) {
      shop = await Shop.findById(listing.shop)
        .select('name slug logo isVerified averageRating reviewCount settings')
        .lean();
    }

    // Get more from this seller
    const moreFromSeller = await Listing.find({
      seller: listing.seller,
      _id: { $ne: listing._id },
      status: 'active',
    })
      .select('title slug price images condition')
      .limit(4)
      .lean();

    // Get similar listings
    const similarListings = await Listing.find({
      category: listing.category,
      _id: { $ne: listing._id },
      status: 'active',
    })
      .select('title slug price images condition sellerUsername')
      .sort({ viewCount: -1 })
      .limit(8)
      .lean();

    return NextResponse.json({
      success: true,
      data: {
        ...listing,
        viewCount: (listing.viewCount || 0) + 1,
        isSaved,
        seller,
        shop,
        moreFromSeller,
        similarListings,
      },
    });
  } catch (error) {
    console.error('Error fetching listing:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch listing' },
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

    const isAdmin = forumUser.role === 'admin' || forumUser.role === 'moderator';

    if (!isOwner && !isShopStaff && !isAdmin) {
      return NextResponse.json(
        { success: false, error: 'You do not have permission to edit this listing' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const allowedFields = [
      'title', 'description', 'category', 'condition', 'price', 'originalPrice',
      'priceNegotiable', 'acceptsOffers', 'brand', 'partNumber', 'quantity',
      'compatibility', 'location', 'shipping', 'images', 'videos', 'status',
    ];

    // Filter to only allowed fields
    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    // Process images if provided
    if (updates.images && Array.isArray(updates.images)) {
      updates.images = (updates.images as { url: string; thumbnail?: string }[]).map(
        (img, i) => ({
          url: img.url,
          thumbnail: img.thumbnail,
          order: i,
        })
      );
    }

    // Track price changes for notifications
    const oldPrice = listing.price;
    const newPrice = updates.price as number | undefined;

    // Update listing
    const updatedListing = await Listing.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    // Notify watchers of price drop
    if (newPrice !== undefined && newPrice < oldPrice) {
      // TODO: Send price drop notifications to users who saved this listing
    }

    return NextResponse.json({
      success: true,
      data: updatedListing,
    });
  } catch (error) {
    console.error('Error updating listing:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update listing' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
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

    const isAdmin = forumUser.role === 'admin' || forumUser.role === 'moderator';

    if (!isOwner && !isShopStaff && !isAdmin) {
      return NextResponse.json(
        { success: false, error: 'You do not have permission to delete this listing' },
        { status: 403 }
      );
    }

    // Soft delete by setting status to removed
    await Listing.findByIdAndUpdate(id, {
      status: 'removed',
      removedAt: new Date(),
      removedBy: forumUser._id,
    });

    // Update shop stats if applicable
    if (listing.shop && listing.status === 'active') {
      await Shop.findByIdAndUpdate(listing.shop, {
        $inc: { activeListings: -1 },
      });
    }

    // Remove from saved listings
    await SavedListing.deleteMany({ listing: id });

    return NextResponse.json({
      success: true,
      message: 'Listing deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting listing:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete listing' },
      { status: 500 }
    );
  }
}
