import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import prisma from '@/lib/prisma';
import { z } from 'zod';

// Route creation schema
const createRouteSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(2000).optional(),
  pathCoordinates: z.array(z.tuple([z.number(), z.number()])).min(2),
  waypoints: z.array(z.object({ lng: z.number(), lat: z.number(), order: z.number() })).optional(),
  distanceMiles: z.number().positive(),
  durationSeconds: z.number().optional(),
  elevationGain: z.number().optional(),
  estimatedTime: z.number().optional(),
  difficulty: z.enum(['EASY', 'MODERATE', 'CHALLENGING', 'EXPERT']),
  tags: z.array(z.string()).optional(),
  creationMethod: z.enum(['manual', 'recorded']).optional(),
  isPublic: z.boolean().optional().default(true),
});

// GET /api/routes - List routes
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const difficulty = searchParams.get('difficulty');
    const search = searchParams.get('search');
    const sortBy = searchParams.get('sortBy') || 'driveCount';

    const skip = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = {
      isPublic: true,
    };

    if (difficulty) {
      where.difficulty = difficulty;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { tags: { has: search.toLowerCase() } },
      ];
    }

    // Build orderBy
    let orderBy: Record<string, string> = {};
    switch (sortBy) {
      case 'rating':
        orderBy = { avgRating: 'desc' };
        break;
      case 'newest':
        orderBy = { createdAt: 'desc' };
        break;
      default:
        orderBy = { driveCount: 'desc' };
    }

    const [routes, total] = await Promise.all([
      prisma.route.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          creator: {
            select: {
              username: true,
              displayName: true,
              avatarUrl: true,
            },
          },
          _count: {
            select: { ratings: true },
          },
        },
      }),
      prisma.route.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: routes,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + routes.length < total,
      },
    });
  } catch (error) {
    console.error('Error fetching routes:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch routes' },
      { status: 500 }
    );
  }
}

// POST /api/routes - Create a new route
export async function POST(request: NextRequest) {
  try {
    const isDev = process.env.NODE_ENV === 'development';
    let userId = '';

    if (isDev) {
      try {
        const supabase = await createServerSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) userId = user.id;
      } catch {
        // Supabase auth failed in dev
      }
      if (!userId) {
        userId = '00000000-0000-0000-0000-000000000001';
        // Ensure dev user exists in DB
        await prisma.user.upsert({
          where: { id: userId },
          update: {},
          create: {
            id: userId,
            email: 'test@evasion.dev',
            username: 'testdriver',
            displayName: 'Test Driver',
            dateOfBirth: new Date('2000-01-01'),
          },
        });
      }
    } else {
      const supabase = await createServerSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 401 }
        );
      }
      userId = user.id;
    }

    const body = await request.json();
    const validationResult = createRouteSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid input', details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const data = validationResult.data;

    // Create the route
    const route = await prisma.route.create({
      data: {
        creatorId: userId,
        name: data.name,
        description: data.description,
        pathCoordinates: data.pathCoordinates,
        waypoints: data.waypoints || [],
        distanceMiles: data.distanceMiles,
        durationSeconds: data.durationSeconds,
        estimatedTime: data.estimatedTime,
        elevationGain: data.elevationGain,
        difficulty: data.difficulty,
        tags: data.tags || [],
        creationMethod: data.creationMethod,
        isPublic: data.isPublic,
      },
      include: {
        creator: {
          select: {
            username: true,
            displayName: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: route,
    });
  } catch (error) {
    console.error('Error creating route:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create route' },
      { status: 500 }
    );
  }
}
