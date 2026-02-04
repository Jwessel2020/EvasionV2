import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { ForumUser } from '@/models/forum';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * GET /api/forum/users - Get users (search, browse)
 * POST /api/forum/users - Create/update forum profile
 */

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const sort = searchParams.get('sort') || 'reputation';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
    const skip = (page - 1) * limit;
    
    // Build query
    const query: Record<string, unknown> = { isBanned: false };
    
    if (search) {
      query.$text = { $search: search };
    }
    
    // Sort options
    const sortOptions: Record<string, Record<string, 1 | -1>> = {
      reputation: { reputation: -1 },
      newest: { createdAt: -1 },
      active: { lastActiveAt: -1 },
      posts: { postCount: -1 },
    };
    
    const users = await ForumUser.find(query)
      .select('username displayName avatar bio reputation postCount threadCount followerCount garage createdAt lastActiveAt')
      .sort(sortOptions[sort] || sortOptions.reputation)
      .skip(skip)
      .limit(limit)
      .lean();
    
    const total = await ForumUser.countDocuments(query);
    
    return NextResponse.json({
      success: true,
      data: users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch users' },
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
    
    const body = await request.json();
    const { username, displayName, bio, location, website, avatar } = body;
    
    // Check if user already has a forum profile
    let forumUser = await ForumUser.findOne({ authId: user.id });
    
    if (forumUser) {
      // Update existing profile
      if (displayName) forumUser.displayName = displayName;
      if (bio !== undefined) forumUser.bio = bio;
      if (location !== undefined) forumUser.location = location;
      if (website !== undefined) forumUser.website = website;
      if (avatar) forumUser.avatar = avatar;
      
      forumUser.lastActiveAt = new Date();
      await forumUser.save();
    } else {
      // Create new profile
      if (!username) {
        return NextResponse.json(
          { success: false, error: 'Username is required' },
          { status: 400 }
        );
      }
      
      // Validate username
      if (!/^[a-z0-9_]{3,30}$/.test(username.toLowerCase())) {
        return NextResponse.json(
          { success: false, error: 'Username must be 3-30 characters, alphanumeric and underscores only' },
          { status: 400 }
        );
      }
      
      // Check username availability
      const existing = await ForumUser.findOne({ username: username.toLowerCase() });
      if (existing) {
        return NextResponse.json(
          { success: false, error: 'Username already taken' },
          { status: 400 }
        );
      }
      
      forumUser = new ForumUser({
        authId: user.id,
        username: username.toLowerCase(),
        displayName: displayName || username,
        bio,
        location,
        website,
        avatar: avatar || user.user_metadata?.avatar_url,
      });
      
      await forumUser.save();
    }
    
    return NextResponse.json({
      success: true,
      data: forumUser,
    });
  } catch (error) {
    console.error('Error creating/updating user:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create/update profile' },
      { status: 500 }
    );
  }
}
