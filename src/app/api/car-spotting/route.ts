import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import connectDB from '@/lib/mongodb';
import { Thread } from '@/models/forum';
import mongoose from 'mongoose';

/**
 * GET /api/car-spotting
 * Fetch car spottings with optional filters
 *
 * Query params:
 * - bounds: "west,south,east,north" - filter by map bounds
 * - dateFrom: ISO date string - filter from date
 * - dateTo: ISO date string - filter to date
 * - make: filter by car make
 * - model: filter by car model
 * - color: filter by car color
 * - limit: number of results (default 50, max 200)
 * - offset: pagination offset
 * - format: 'geojson' | 'list' (default 'list')
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const bounds = searchParams.get('bounds');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const make = searchParams.get('make');
    const model = searchParams.get('model');
    const color = searchParams.get('color');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
    const offset = parseInt(searchParams.get('offset') || '0');
    const format = searchParams.get('format') || 'list';

    // Build where clause
    const where: Record<string, unknown> = {};

    // Bounds filter
    if (bounds) {
      const [west, south, east, north] = bounds.split(',').map(Number);
      where.latitude = { gte: south, lte: north };
      where.longitude = { gte: west, lte: east };
    }

    // Date filters
    if (dateFrom || dateTo) {
      where.spottedAt = {};
      if (dateFrom) (where.spottedAt as Record<string, Date>).gte = new Date(dateFrom);
      if (dateTo) (where.spottedAt as Record<string, Date>).lte = new Date(dateTo);
    }

    // Car filters
    if (make) where.make = { contains: make, mode: 'insensitive' };
    if (model) where.model = { contains: model, mode: 'insensitive' };
    if (color) where.color = { contains: color, mode: 'insensitive' };

    // Fetch spottings
    const [spottings, total] = await Promise.all([
      prisma.carSpotting.findMany({
        where,
        orderBy: { spottedAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          spotter: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
            },
          },
        },
      }),
      prisma.carSpotting.count({ where }),
    ]);

    // GeoJSON format for map
    if (format === 'geojson') {
      const features = spottings.map(spot => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [spot.longitude, spot.latitude],
        },
        properties: {
          id: spot.id,
          make: spot.make,
          model: spot.model,
          color: spot.color,
          year: spot.year,
          thumbnail: spot.photos[0] || null,
          spottedAt: spot.spottedAt.toISOString(),
          spotter: spot.spotter.username,
          likeCount: spot.likeCount,
          viewCount: spot.viewCount,
        },
      }));

      return NextResponse.json({
        success: true,
        data: {
          type: 'FeatureCollection',
          features,
        },
        meta: {
          total,
          limit,
          offset,
        },
      });
    }

    // List format
    return NextResponse.json({
      success: true,
      data: spottings.map(spot => ({
        id: spot.id,
        make: spot.make,
        model: spot.model,
        color: spot.color,
        year: spot.year,
        photos: spot.photos,
        videoUrl: spot.videoUrl,
        description: spot.description,
        latitude: spot.latitude,
        longitude: spot.longitude,
        spottedAt: spot.spottedAt,
        threadId: spot.threadId,
        likeCount: spot.likeCount,
        viewCount: spot.viewCount,
        spotter: {
          id: spot.spotter.id,
          username: spot.spotter.username,
          avatar: spot.spotter.avatarUrl,
        },
      })),
      meta: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error('Error fetching car spottings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch car spottings' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/car-spotting
 * Create a new car spotting
 *
 * Request body:
 * {
 *   latitude: number,
 *   longitude: number,
 *   make: string,
 *   model: string,
 *   color?: string,
 *   year?: number,
 *   photos: string[],
 *   videoUrl?: string,
 *   description: string,
 *   spotterId?: string // If not provided, uses test user
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      latitude,
      longitude,
      make,
      model,
      color,
      year,
      photos = [],
      videoUrl,
      description,
      spotterId,
    } = body;

    // Validate required fields
    if (!latitude || !longitude) {
      return NextResponse.json(
        { success: false, error: 'Location (latitude, longitude) is required' },
        { status: 400 }
      );
    }

    if (!make || !model) {
      return NextResponse.json(
        { success: false, error: 'Car make and model are required' },
        { status: 400 }
      );
    }

    if (photos.length === 0 && !videoUrl) {
      return NextResponse.json(
        { success: false, error: 'At least one photo or video is required' },
        { status: 400 }
      );
    }

    // Get or create test user for development
    let userId = spotterId;
    if (!userId) {
      // Try to find a test user
      const testUser = await prisma.user.findFirst({
        where: { email: { contains: 'test' } },
      });

      if (testUser) {
        userId = testUser.id;
      } else {
        // Create a test user if none exists
        const newUser = await prisma.user.create({
          data: {
            email: 'test@evasion.local',
            username: 'TestSpotter',
            displayName: 'Test Spotter',
            dateOfBirth: new Date('1990-01-01'),
          },
        });
        userId = newUser.id;
      }
    }

    // Create the car spotting record
    const spotting = await prisma.carSpotting.create({
      data: {
        spotterId: userId,
        latitude,
        longitude,
        make,
        model,
        color,
        year: year ? parseInt(year) : null,
        photos,
        videoUrl,
        description,
      },
      include: {
        spotter: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
          },
        },
      },
    });

    // Create a forum thread for this spotting
    let threadId: string | null = null;
    try {
      await connectDB();

      // Generate slug from make/model
      const timestamp = Date.now();
      const slug = `${make}-${model}-${timestamp}`.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

      // Create a showcase thread
      const thread = await Thread.create({
        title: `${year ? year + ' ' : ''}${make} ${model}${color ? ' (' + color + ')' : ''}`,
        slug,
        content: description || `Spotted this ${make} ${model}!`,
        excerpt: description?.substring(0, 200) || `A ${make} ${model} spotted in the wild`,
        author: new mongoose.Types.ObjectId(), // Placeholder - would link to forum user
        authorUsername: spotting.spotter.username,
        authorAvatar: spotting.spotter.avatarUrl || undefined,
        type: 'showcase',
        status: 'open',
        tags: ['car-spotting', make.toLowerCase(), model.toLowerCase(), color?.toLowerCase()].filter(Boolean) as string[],
        images: photos.map((url: string, index: number) => ({
          url,
          order: index,
        })),
        videos: videoUrl ? [{ url: videoUrl, provider: 'direct' }] : [],
        vehicle: {
          year: year ? parseInt(year) : undefined,
          make,
          model,
        },
        viewCount: 0,
        replyCount: 0,
        likeCount: 0,
      });

      threadId = thread._id.toString();

      // Update the spotting with the thread ID
      await prisma.carSpotting.update({
        where: { id: spotting.id },
        data: { threadId },
      });
    } catch (threadError) {
      console.error('Error creating forum thread:', threadError);
      // Don't fail the entire request if thread creation fails
    }

    return NextResponse.json({
      success: true,
      data: {
        id: spotting.id,
        make: spotting.make,
        model: spotting.model,
        color: spotting.color,
        year: spotting.year,
        photos: spotting.photos,
        videoUrl: spotting.videoUrl,
        description: spotting.description,
        latitude: spotting.latitude,
        longitude: spotting.longitude,
        spottedAt: spotting.spottedAt,
        threadId,
        spotter: {
          id: spotting.spotter.id,
          username: spotting.spotter.username,
          avatar: spotting.spotter.avatarUrl,
        },
      },
    });
  } catch (error) {
    console.error('Error creating car spotting:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create car spotting' },
      { status: 500 }
    );
  }
}
