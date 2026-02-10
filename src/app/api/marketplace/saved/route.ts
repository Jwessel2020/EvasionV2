import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { Listing, SavedListing } from '@/models/marketplace';
import { ForumUser } from '@/models/forum';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * GET /api/marketplace/saved - Get user's saved listings
 * POST /api/marketplace/saved - Save/unsave a listing
 * DELETE /api/marketplace/saved - Remove a saved listing
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
    const limit = Math.min(parseInt(searchParams.get('limit') || '24'), 50);
    const skip = (page - 1) * limit;

    const [savedItems, total] = await Promise.all([
      SavedListing.find({ user: forumUser._id })
        .sort({ savedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      SavedListing.countDocuments({ user: forumUser._id }),
    ]);

    // Get listing details
    const listingIds = savedItems.map((s) => s.listing);
    const listings = await Listing.find({ _id: { $in: listingIds } })
      .select('title slug price originalPrice condition images status sellerUsername shopName location createdAt')
      .lean();

    // Map listings to saved items with price change info
    const listingsMap = new Map(listings.map((l) => [l._id.toString(), l]));
    const enrichedItems = savedItems.map((saved) => {
      const listing = listingsMap.get(saved.listing.toString());
      const priceChanged = saved.savedAtPrice && listing && listing.price !== saved.savedAtPrice;
      const priceDropped = priceChanged && listing && listing.price < saved.savedAtPrice;

      return {
        ...saved,
        listing,
        priceChanged,
        priceDropped,
        priceDifference: listing && saved.savedAtPrice
          ? listing.price - saved.savedAtPrice
          : 0,
      };
    });

    return NextResponse.json({
      success: true,
      data: enrichedItems,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching saved listings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch saved listings' },
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
    const { listingId, notifyOnPriceDrop = true, notifyOnSale = false } = body;

    if (!listingId) {
      return NextResponse.json(
        { success: false, error: 'Listing ID is required' },
        { status: 400 }
      );
    }

    const listing = await Listing.findById(listingId);
    if (!listing) {
      return NextResponse.json(
        { success: false, error: 'Listing not found' },
        { status: 404 }
      );
    }

    // Check if already saved (toggle behavior)
    const existing = await SavedListing.findOne({
      user: forumUser._id,
      listing: listingId,
    });

    if (existing) {
      // Unsave
      await SavedListing.findByIdAndDelete(existing._id);
      await Listing.findByIdAndUpdate(listingId, { $inc: { saveCount: -1 } });

      return NextResponse.json({
        success: true,
        saved: false,
        message: 'Listing removed from saved items',
      });
    }

    // Save the listing
    await SavedListing.create({
      user: forumUser._id,
      listing: listingId,
      savedAtPrice: listing.price,
      notifyOnPriceDrop,
      notifyOnSale,
    });

    await Listing.findByIdAndUpdate(listingId, { $inc: { saveCount: 1 } });

    return NextResponse.json({
      success: true,
      saved: true,
      message: 'Listing saved',
    });
  } catch (error) {
    console.error('Error saving listing:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save listing' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
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
    const listingId = searchParams.get('listingId');

    if (!listingId) {
      return NextResponse.json(
        { success: false, error: 'Listing ID is required' },
        { status: 400 }
      );
    }

    const deleted = await SavedListing.findOneAndDelete({
      user: forumUser._id,
      listing: listingId,
    });

    if (deleted) {
      await Listing.findByIdAndUpdate(listingId, { $inc: { saveCount: -1 } });
    }

    return NextResponse.json({
      success: true,
      message: 'Listing removed from saved items',
    });
  } catch (error) {
    console.error('Error removing saved listing:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to remove saved listing' },
      { status: 500 }
    );
  }
}
