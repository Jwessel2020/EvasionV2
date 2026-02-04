import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { Thread } from '@/models/forum';

/**
 * GET /api/forum/threads/[id] - Get a single thread by ID or slug
 */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    
    const { id } = await params;
    
    // Try to find by ID first, then by slug
    let thread = await Thread.findById(id)
      .populate('author', 'username displayName avatar reputation role')
      .populate('board', 'name slug color')
      .populate('group', 'name slug avatar')
      .lean();
    
    if (!thread) {
      // Try finding by slug
      thread = await Thread.findOne({ slug: id })
        .populate('author', 'username displayName avatar reputation role')
        .populate('board', 'name slug color')
        .populate('group', 'name slug avatar')
        .lean();
    }
    
    if (!thread) {
      return NextResponse.json(
        { success: false, error: 'Thread not found' },
        { status: 404 }
      );
    }
    
    // Increment view count (fire and forget)
    Thread.findByIdAndUpdate(thread._id, { $inc: { viewCount: 1 } }).exec();
    
    return NextResponse.json({
      success: true,
      data: thread,
    });
  } catch (error) {
    console.error('Error fetching thread:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch thread' },
      { status: 500 }
    );
  }
}
