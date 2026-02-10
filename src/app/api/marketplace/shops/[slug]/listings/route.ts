import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { Shop, Listing } from '@/models/marketplace';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

/**
 * GET /api/marketplace/shops/[slug]/listings - Get all listings from a shop
 */

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params;
    await connectDB();

    const shop = await Shop.findOne({ slug });
    if (!shop) {
      return NextResponse.json(
        { success: false, error: 'Shop not found' },
        { status: 404 }
      );
    }

    if (shop.status !== 'active') {
      return NextResponse.json(
        { success: false, error: 'This shop is not available' },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);

    // Filters
    const category = searchParams.get('category');
    const condition = searchParams.get('condition');
    const minPrice = searchParams.get('minPrice');
    const maxPrice = searchParams.get('maxPrice');
    const search = searchParams.get('search');

    // Sorting
    const sort = searchParams.get('sort') || 'newest';

    // Pagination
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '24'), 50);
    const skip = (page - 1) * limit;

    // Build query
    const query: Record<string, unknown> = {
      shop: shop._id,
      status: 'active',
    };

    if (category) {
      query.category = category;
    }

    if (condition) {
      query.condition = { $in: condition.split(',') };
    }

    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) (query.price as Record<string, number>).$gte = parseFloat(minPrice);
      if (maxPrice) (query.price as Record<string, number>).$lte = parseFloat(maxPrice);
    }

    if (search) {
      query.$text = { $search: search };
    }

    // Sort options
    const sortOptions: Record<string, Record<string, 1 | -1 | { $meta: string }>> = {
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      priceAsc: { price: 1 },
      priceDesc: { price: -1 },
      popular: { viewCount: -1 },
    };

    if (search) {
      sortOptions.relevant = { score: { $meta: 'textScore' } };
    }

    const listingsQuery = Listing.find(query)
      .select('title slug price originalPrice condition category images createdAt viewCount')
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

    // Get category breakdown
    const categories = await Listing.aggregate([
      { $match: { shop: shop._id, status: 'active' } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
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
      categories,
      shop: {
        name: shop.name,
        slug: shop.slug,
        logo: shop.logo,
        isVerified: shop.isVerified,
      },
    });
  } catch (error) {
    console.error('Error fetching shop listings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch shop listings' },
      { status: 500 }
    );
  }
}
