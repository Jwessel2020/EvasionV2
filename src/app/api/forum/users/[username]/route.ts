import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { ForumUser } from '@/models/forum';

/**
 * GET /api/forum/users/[username] - Get a user by username
 */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    await connectDB();
    
    const { username } = await params;
    
    const user = await ForumUser.findOne({ 
      username: username.toLowerCase(),
      isBanned: false,
    })
      .select('-authId -preferences -banReason -banExpiresAt')
      .lean();
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }
    
    // Update last active (fire and forget)
    ForumUser.findByIdAndUpdate(user._id, { lastActiveAt: new Date() }).exec();
    
    return NextResponse.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch user' },
      { status: 500 }
    );
  }
}
