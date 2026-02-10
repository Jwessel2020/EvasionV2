import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { Listing, Shop } from '@/models/marketplace';
import { ForumUser } from '@/models/forum';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * GET /api/marketplace/listings - Browse listings with filters
 * POST /api/marketplace/listings - Create a new listing
 */

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);

    // Filters
    const category = searchParams.get('category');
    const condition = searchParams.get('condition');
    const minPrice = searchParams.get('minPrice');
    const maxPrice = searchParams.get('maxPrice');
    const state = searchParams.get('state');
    const country = searchParams.get('country') || 'US';
    const make = searchParams.get('make');
    const model = searchParams.get('model');
    const yearMin = searchParams.get('yearMin');
    const yearMax = searchParams.get('yearMax');
    const seller = searchParams.get('seller');
    const shop = searchParams.get('shop');
    const shopSlug = searchParams.get('shopSlug');
    const freeShipping = searchParams.get('freeShipping');
    const localPickup = searchParams.get('localPickup');
    const search = searchParams.get('search');
    const featured = searchParams.get('featured');

    // Sorting
    const sort = searchParams.get('sort') || 'newest';

    // Pagination
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '24'), 50);
    const skip = (page - 1) * limit;

    // Build query
    const query: Record<string, unknown> = {
      status: 'active',
    };

    // Category filter
    if (category) {
      query.category = category;
    }

    // Condition filter
    if (condition) {
      const conditions = condition.split(',');
      query.condition = { $in: conditions };
    }

    // Price range
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) (query.price as Record<string, number>).$gte = parseFloat(minPrice);
      if (maxPrice) (query.price as Record<string, number>).$lte = parseFloat(maxPrice);
    }

    // Location filters
    if (state) {
      query['location.state'] = state;
    }
    if (country) {
      query['location.country'] = country;
    }

    // Vehicle compatibility
    if (make) {
      query.$or = [
        { 'compatibility.universal': true },
        { 'compatibility.vehicles.make': { $regex: new RegExp(`^${make}$`, 'i') } },
      ];

      if (model) {
        query.$or = [
          { 'compatibility.universal': true },
          {
            'compatibility.vehicles.make': { $regex: new RegExp(`^${make}$`, 'i') },
            'compatibility.vehicles.model': { $regex: new RegExp(`^${model}$`, 'i') },
          },
        ];
      }
    }

    // Year filter for compatibility
    if (yearMin || yearMax) {
      const yearQuery: Record<string, unknown>[] = [{ 'compatibility.universal': true }];
      const vehicleMatch: Record<string, unknown> = {};

      if (yearMin) {
        vehicleMatch.$or = [
          { 'compatibility.vehicles.year': { $gte: parseInt(yearMin) } },
          { 'compatibility.vehicles.yearMax': { $gte: parseInt(yearMin) } },
        ];
      }
      if (yearMax) {
        vehicleMatch.$or = [
          ...(vehicleMatch.$or as Record<string, unknown>[] || []),
          { 'compatibility.vehicles.year': { $lte: parseInt(yearMax) } },
          { 'compatibility.vehicles.yearMin': { $lte: parseInt(yearMax) } },
        ];
      }

      yearQuery.push(vehicleMatch);
      if (!query.$or) {
        query.$or = yearQuery;
      }
    }

    // Seller filter
    if (seller) {
      query.seller = seller;
    }

    // Shop filter
    if (shop) {
      query.shop = shop;
    } else if (shopSlug) {
      const shopDoc = await Shop.findOne({ slug: shopSlug });
      if (shopDoc) {
        query.shop = shopDoc._id;
      }
    }

    // Shipping filters
    if (freeShipping === 'true') {
      query['shipping.freeShipping'] = true;
    }
    if (localPickup === 'true') {
      query['shipping.localPickup'] = true;
    }

    // Featured filter
    if (featured === 'true') {
      query.isFeatured = true;
      query.featuredUntil = { $gte: new Date() };
    }

    // Text search
    if (search) {
      query.$text = { $search: search };
    }

    // Sort options
    const sortOptions: Record<string, Record<string, 1 | -1 | { $meta: string }>> = {
      newest: { isFeatured: -1, createdAt: -1 },
      oldest: { createdAt: 1 },
      priceAsc: { isFeatured: -1, price: 1 },
      priceDesc: { isFeatured: -1, price: -1 },
      popular: { isFeatured: -1, viewCount: -1 },
      bumped: { isFeatured: -1, bumpedAt: -1, createdAt: -1 },
    };

    // Add relevance for text search
    if (search) {
      sortOptions.relevant = { score: { $meta: 'textScore' } };
    }

    const listingsQuery = Listing.find(query)
      .select('-descriptionHtml')
      .sort(sortOptions[sort] || sortOptions.newest)
      .skip(skip)
      .limit(limit);

    if (search) {
      listingsQuery.select({ score: { $meta: 'textScore' } });
    }

    const [listings, total] = await Promise.all([
      listingsQuery.lean(),
      Listing.countDocuments(query),
    ]);

    return NextResponse.json({
      success: true,
      data: listings,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching listings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch listings' },
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

    // Get forum user
    const forumUser = await ForumUser.findOne({ authId: user.id });
    if (!forumUser) {
      return NextResponse.json(
        { success: false, error: 'Please create a profile first' },
        { status: 400 }
      );
    }

    if (forumUser.isBanned) {
      return NextResponse.json(
        { success: false, error: 'Your account is banned' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      title,
      description,
      category,
      condition,
      price,
      originalPrice,
      priceNegotiable = false,
      acceptsOffers = true,
      brand,
      partNumber,
      quantity = 1,
      compatibility = { universal: false, vehicles: [] },
      location,
      shipping = { localPickup: true, willShip: false, shipsTo: [], freeShipping: false },
      images = [],
      videos = [],
      shopId,
      status = 'active',
    } = body;

    // Validation
    if (!title || !description || !category || !condition || price === undefined) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (price < 0) {
      return NextResponse.json(
        { success: false, error: 'Price cannot be negative' },
        { status: 400 }
      );
    }

    if (images.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one image is required' },
        { status: 400 }
      );
    }

    // Verify shop ownership if posting for shop
    let shopDoc = null;
    if (shopId) {
      shopDoc = await Shop.findById(shopId);
      if (!shopDoc) {
        return NextResponse.json(
          { success: false, error: 'Shop not found' },
          { status: 404 }
        );
      }

      // Check if user is owner or staff
      const isOwner = shopDoc.owner.toString() === forumUser._id.toString();
      const isStaff = shopDoc.staff.some(
        (s: { userId: { toString: () => string } }) => s.userId.toString() === forumUser._id.toString()
      );

      if (!isOwner && !isStaff) {
        return NextResponse.json(
          { success: false, error: 'You do not have permission to post for this shop' },
          { status: 403 }
        );
      }

      if (shopDoc.status !== 'active') {
        return NextResponse.json(
          { success: false, error: 'This shop is not active' },
          { status: 403 }
        );
      }
    }

    // Generate slug
    const baseSlug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 80);
    const uniqueId = Math.random().toString(36).substring(2, 8);
    const slug = `${baseSlug}-${uniqueId}`;

    // Calculate expiration (30 days for user listings, no expiry for shops)
    const expiresAt = shopId ? undefined : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const listing = new Listing({
      title,
      slug,
      description,
      seller: forumUser._id,
      sellerUsername: forumUser.username,
      sellerAvatar: forumUser.avatar,
      sellerReputation: forumUser.reputation || 0,
      shop: shopId || undefined,
      shopName: shopDoc?.name,
      shopSlug: shopDoc?.slug,
      category,
      listingType: shopId ? 'shop' : 'user',
      condition,
      brand,
      partNumber,
      quantity,
      compatibility,
      price,
      originalPrice,
      priceNegotiable,
      acceptsOffers,
      location: location || {
        country: 'US',
      },
      shipping,
      images: images.map((img: { url: string; thumbnail?: string }, i: number) => ({
        url: img.url,
        thumbnail: img.thumbnail,
        order: i,
      })),
      videos,
      status,
      expiresAt,
    });

    await listing.save();

    // Update shop listing count
    if (shopDoc) {
      await Shop.findByIdAndUpdate(shopId, {
        $inc: { listingCount: 1, activeListings: 1 },
      });
    }

    return NextResponse.json({
      success: true,
      data: listing,
    });
  } catch (error) {
    console.error('Error creating listing:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create listing' },
      { status: 500 }
    );
  }
}
