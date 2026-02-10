import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { Listing, Shop } from '@/models/marketplace';
import { ForumUser } from '@/models/forum';
import { createServerSupabaseClient } from '@/lib/supabase/server';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Bump cooldown in hours (users can bump once every 24 hours)
const BUMP_COOLDOWN_HOURS = 24;
const MAX_BUMPS = 10; // Maximum number of bumps per listing

/**
 * POST /api/marketplace/listings/[id]/bump - Bump a listing to top
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
        { success: false, error: 'You do not have permission to bump this listing' },
        { status: 403 }
      );
    }

    // Check if listing is active
    if (listing.status !== 'active') {
      return NextResponse.json(
        { success: false, error: 'Only active listings can be bumped' },
        { status: 400 }
      );
    }

    // Check bump count
    if (listing.bumpCount >= MAX_BUMPS) {
      return NextResponse.json(
        { success: false, error: `Maximum of ${MAX_BUMPS} bumps reached for this listing` },
        { status: 400 }
      );
    }

    // Check cooldown
    if (listing.bumpedAt) {
      const hoursSinceLastBump = (Date.now() - new Date(listing.bumpedAt).getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastBump < BUMP_COOLDOWN_HOURS) {
        const hoursRemaining = Math.ceil(BUMP_COOLDOWN_HOURS - hoursSinceLastBump);
        return NextResponse.json(
          {
            success: false,
            error: `You can bump this listing again in ${hoursRemaining} hour${hoursRemaining !== 1 ? 's' : ''}`
          },
          { status: 400 }
        );
      }
    }

    // Bump the listing
    const updatedListing = await Listing.findByIdAndUpdate(
      id,
      {
        bumpedAt: new Date(),
        $inc: { bumpCount: 1 },
      },
      { new: true }
    );

    return NextResponse.json({
      success: true,
      data: updatedListing,
      message: 'Listing bumped successfully',
    });
  } catch (error) {
    console.error('Error bumping listing:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to bump listing' },
      { status: 500 }
    );
  }
}
