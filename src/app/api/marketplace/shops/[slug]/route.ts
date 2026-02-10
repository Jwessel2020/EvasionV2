import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { Shop, Listing } from '@/models/marketplace';
import { ForumUser, Follow } from '@/models/forum';
import { createServerSupabaseClient } from '@/lib/supabase/server';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

/**
 * GET /api/marketplace/shops/[slug] - Get shop storefront
 * PATCH /api/marketplace/shops/[slug] - Update shop settings
 */

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params;
    await connectDB();

    const shop = await Shop.findOne({ slug }).lean();

    if (!shop) {
      return NextResponse.json(
        { success: false, error: 'Shop not found' },
        { status: 404 }
      );
    }

    // Only show active shops publicly
    if (shop.status !== 'active') {
      // Check if current user is owner or staff
      let canView = false;

      try {
        const supabase = await createServerSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          const forumUser = await ForumUser.findOne({ authId: user.id });
          if (forumUser) {
            const isOwner = shop.owner.toString() === forumUser._id.toString();
            const isStaff = shop.staff.some(
              (s: { userId: { toString: () => string } }) => s.userId.toString() === forumUser._id.toString()
            );
            const isAdmin = forumUser.role === 'admin';
            canView = isOwner || isStaff || isAdmin;
          }
        }
      } catch {
        // Ignore auth errors
      }

      if (!canView) {
        return NextResponse.json(
          { success: false, error: 'This shop is not available' },
          { status: 404 }
        );
      }
    }

    // Get owner info
    const owner = await ForumUser.findById(shop.owner)
      .select('username displayName avatar reputation createdAt')
      .lean();

    // Get featured/recent listings
    const { searchParams } = new URL(request.url);
    const listingsPage = parseInt(searchParams.get('listingsPage') || '1');
    const listingsLimit = Math.min(parseInt(searchParams.get('listingsLimit') || '12'), 24);
    const listingsSort = searchParams.get('listingsSort') || 'newest';
    const listingsCategory = searchParams.get('category');

    const listingsQuery: Record<string, unknown> = {
      shop: shop._id,
      status: 'active',
    };

    if (listingsCategory) {
      listingsQuery.category = listingsCategory;
    }

    const sortOptions: Record<string, Record<string, 1 | -1>> = {
      newest: { createdAt: -1 },
      priceAsc: { price: 1 },
      priceDesc: { price: -1 },
      popular: { viewCount: -1 },
    };

    const [listings, totalListings] = await Promise.all([
      Listing.find(listingsQuery)
        .select('title slug price originalPrice condition images category createdAt')
        .sort(sortOptions[listingsSort] || sortOptions.newest)
        .skip((listingsPage - 1) * listingsLimit)
        .limit(listingsLimit)
        .lean(),
      Listing.countDocuments(listingsQuery),
    ]);

    // Category breakdown
    const categoryBreakdown = await Listing.aggregate([
      { $match: { shop: shop._id, status: 'active' } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    // Check if current user follows this shop
    let isFollowing = false;
    let isOwnerOrStaff = false;

    try {
      const supabase = await createServerSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const forumUser = await ForumUser.findOne({ authId: user.id });
        if (forumUser) {
          const follow = await Follow.findOne({
            follower: forumUser._id,
            following: shop._id,
            targetType: 'shop',
          });
          isFollowing = !!follow;

          isOwnerOrStaff = shop.owner.toString() === forumUser._id.toString() ||
            shop.staff.some(
              (s: { userId: { toString: () => string } }) => s.userId.toString() === forumUser._id.toString()
            );
        }
      }
    } catch {
      // Ignore auth errors
    }

    // Hide sensitive info if vacation mode is on
    const publicShop = { ...shop };
    if (shop.settings?.vacationMode && !isOwnerOrStaff) {
      (publicShop as Record<string, unknown>).vacationMessage = shop.settings.vacationMessage || 'This shop is temporarily on vacation.';
    }

    // Hide contact info based on settings
    if (!shop.settings?.showPhone) {
      delete (publicShop as Record<string, unknown>).phone;
    }
    if (!shop.settings?.showEmail && !isOwnerOrStaff) {
      delete (publicShop as Record<string, unknown>).email;
    }

    return NextResponse.json({
      success: true,
      data: {
        ...publicShop,
        owner,
        listings,
        listingsPagination: {
          page: listingsPage,
          limit: listingsLimit,
          total: totalListings,
          pages: Math.ceil(totalListings / listingsLimit),
        },
        categoryBreakdown,
        isFollowing,
        isOwnerOrStaff,
      },
    });
  } catch (error) {
    console.error('Error fetching shop:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch shop' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params;
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

    const shop = await Shop.findOne({ slug });
    if (!shop) {
      return NextResponse.json(
        { success: false, error: 'Shop not found' },
        { status: 404 }
      );
    }

    // Check if user is owner or admin staff
    const isOwner = shop.owner.toString() === forumUser._id.toString();
    const isAdmin = shop.staff.some(
      (s: { userId: { toString: () => string }; role: string }) =>
        s.userId.toString() === forumUser._id.toString() && s.role === 'admin'
    );

    if (!isOwner && !isAdmin && forumUser.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'You do not have permission to edit this shop' },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Fields that can be updated
    const allowedFields = [
      'name', 'description', 'shortDescription', 'logo', 'banner', 'primaryColor',
      'phone', 'website', 'socialLinks', 'location', 'categories', 'brands',
      'vehicleFocus', 'settings', 'policies',
    ];

    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    // If name changes, update slug
    if (updates.name && updates.name !== shop.name) {
      const newSlug = (updates.name as string)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      // Check for duplicate slug
      const existingSlug = await Shop.findOne({
        slug: newSlug,
        _id: { $ne: shop._id },
      });

      if (existingSlug) {
        return NextResponse.json(
          { success: false, error: 'A shop with this name already exists' },
          { status: 400 }
        );
      }

      updates.slug = newSlug;
    }

    const updatedShop = await Shop.findByIdAndUpdate(
      shop._id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    return NextResponse.json({
      success: true,
      data: updatedShop,
    });
  } catch (error) {
    console.error('Error updating shop:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update shop' },
      { status: 500 }
    );
  }
}
