import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/car-spotting/[id]
 * Get a single car spotting by ID
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const spotting = await prisma.carSpotting.findUnique({
      where: { id },
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

    if (!spotting) {
      return NextResponse.json(
        { success: false, error: 'Car spotting not found' },
        { status: 404 }
      );
    }

    // Increment view count
    await prisma.carSpotting.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
    });

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
        threadId: spotting.threadId,
        likeCount: spotting.likeCount,
        viewCount: spotting.viewCount + 1,
        spotter: {
          id: spotting.spotter.id,
          username: spotting.spotter.username,
          avatar: spotting.spotter.avatarUrl,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching car spotting:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch car spotting' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/car-spotting/[id]
 * Delete a car spotting (owner only)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // In production, verify the user owns this spotting
    // For now, just delete it
    const spotting = await prisma.carSpotting.findUnique({
      where: { id },
    });

    if (!spotting) {
      return NextResponse.json(
        { success: false, error: 'Car spotting not found' },
        { status: 404 }
      );
    }

    await prisma.carSpotting.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Car spotting deleted',
    });
  } catch (error) {
    console.error('Error deleting car spotting:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete car spotting' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/car-spotting/[id]
 * Update car spotting (owner only) or like it
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { action } = body;

    const spotting = await prisma.carSpotting.findUnique({
      where: { id },
    });

    if (!spotting) {
      return NextResponse.json(
        { success: false, error: 'Car spotting not found' },
        { status: 404 }
      );
    }

    // Handle like action
    if (action === 'like') {
      const updated = await prisma.carSpotting.update({
        where: { id },
        data: { likeCount: { increment: 1 } },
      });

      return NextResponse.json({
        success: true,
        data: { likeCount: updated.likeCount },
      });
    }

    // Handle unlike action
    if (action === 'unlike') {
      const updated = await prisma.carSpotting.update({
        where: { id },
        data: { likeCount: { decrement: 1 } },
      });

      return NextResponse.json({
        success: true,
        data: { likeCount: Math.max(0, updated.likeCount) },
      });
    }

    // Handle regular update
    const { make, model, color, year, description } = body;

    const updated = await prisma.carSpotting.update({
      where: { id },
      data: {
        ...(make && { make }),
        ...(model && { model }),
        ...(color && { color }),
        ...(year && { year: parseInt(year) }),
        ...(description && { description }),
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

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        make: updated.make,
        model: updated.model,
        color: updated.color,
        year: updated.year,
        photos: updated.photos,
        videoUrl: updated.videoUrl,
        description: updated.description,
        latitude: updated.latitude,
        longitude: updated.longitude,
        spottedAt: updated.spottedAt,
        threadId: updated.threadId,
        likeCount: updated.likeCount,
        viewCount: updated.viewCount,
        spotter: {
          id: updated.spotter.id,
          username: updated.spotter.username,
          avatar: updated.spotter.avatarUrl,
        },
      },
    });
  } catch (error) {
    console.error('Error updating car spotting:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update car spotting' },
      { status: 500 }
    );
  }
}
