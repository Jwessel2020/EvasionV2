import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { Shop, ShopApplication } from '@/models/marketplace';
import { ForumUser } from '@/models/forum';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * GET /api/marketplace/shops - List all shops
 * POST /api/marketplace/shops - Apply to create a shop
 */

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);

    // Filters
    const category = searchParams.get('category');
    const brand = searchParams.get('brand');
    const make = searchParams.get('make');
    const state = searchParams.get('state');
    const verified = searchParams.get('verified');
    const search = searchParams.get('search');

    // Sorting
    const sort = searchParams.get('sort') || 'popular';

    // Pagination
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
    const skip = (page - 1) * limit;

    // Build query - only show active shops
    const query: Record<string, unknown> = {
      status: 'active',
    };

    if (category) {
      query.categories = category;
    }

    if (brand) {
      query.brands = { $regex: new RegExp(brand, 'i') };
    }

    if (make) {
      query['vehicleFocus.make'] = { $regex: new RegExp(`^${make}$`, 'i') };
    }

    if (state) {
      query['location.state'] = state;
    }

    if (verified === 'true') {
      query.isVerified = true;
    }

    if (search) {
      query.$text = { $search: search };
    }

    // Sort options
    const sortOptions: Record<string, Record<string, 1 | -1 | { $meta: string }>> = {
      popular: { isVerified: -1, followerCount: -1, soldCount: -1 },
      rating: { isVerified: -1, averageRating: -1, reviewCount: -1 },
      newest: { createdAt: -1 },
      alphabetical: { name: 1 },
      mostListings: { activeListings: -1 },
    };

    if (search) {
      sortOptions.relevant = { score: { $meta: 'textScore' } };
    }

    const shopsQuery = Shop.find(query)
      .select('name slug shortDescription logo banner isVerified averageRating reviewCount followerCount activeListings soldCount location categories brands vehicleFocus primaryColor')
      .sort(sortOptions[sort] || sortOptions.popular)
      .skip(skip)
      .limit(limit);

    if (search) {
      shopsQuery.select({ score: { $meta: 'textScore' } });
    }

    const [shops, total] = await Promise.all([
      shopsQuery.lean(),
      Shop.countDocuments(query),
    ]);

    return NextResponse.json({
      success: true,
      data: shops,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching shops:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch shops' },
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

    // Check if user already has a shop or pending application
    const existingShop = await Shop.findOne({ owner: forumUser._id });
    if (existingShop) {
      return NextResponse.json(
        { success: false, error: 'You already have a shop' },
        { status: 400 }
      );
    }

    const pendingApplication = await ShopApplication.findOne({
      applicant: forumUser._id,
      status: { $in: ['pending', 'in_review'] },
    });

    if (pendingApplication) {
      return NextResponse.json(
        { success: false, error: 'You already have a pending application' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      shopName,
      businessName,
      businessType,
      description,
      categories = [],
      email,
      phone,
      website,
      location,
      documents = [],
    } = body;

    // Validation
    if (!shopName || !businessType || !description || !email) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check for duplicate shop name
    const existingName = await Shop.findOne({
      name: { $regex: new RegExp(`^${shopName}$`, 'i') },
    });

    if (existingName) {
      return NextResponse.json(
        { success: false, error: 'A shop with this name already exists' },
        { status: 400 }
      );
    }

    // Create application
    const application = new ShopApplication({
      applicant: forumUser._id,
      applicantUsername: forumUser.username,
      shopName,
      businessName,
      businessType,
      description,
      categories,
      email,
      phone,
      website,
      location: location || {
        country: 'US',
      },
      documents,
    });

    await application.save();

    return NextResponse.json({
      success: true,
      data: application,
      message: 'Your shop application has been submitted for review',
    });
  } catch (error) {
    console.error('Error creating shop application:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to submit shop application' },
      { status: 500 }
    );
  }
}
