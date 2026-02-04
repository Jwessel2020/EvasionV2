import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { Group, ForumUser } from '@/models/forum';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * GET /api/forum/groups - Get groups (browse, search)
 * POST /api/forum/groups - Create a new group
 */

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const category = searchParams.get('category');
    const type = searchParams.get('type');
    const tag = searchParams.get('tag');
    const featured = searchParams.get('featured') === 'true';
    const sort = searchParams.get('sort') || 'popular';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
    const skip = (page - 1) * limit;
    
    // Build query
    const query: Record<string, unknown> = { 
      isArchived: false,
      type: { $ne: 'secret' }, // Don't show secret groups in browse
    };
    
    if (category) {
      query.category = category;
    }
    
    if (type && type !== 'secret') {
      query.type = type;
    }
    
    if (tag) {
      query.tags = tag.toLowerCase();
    }
    
    if (featured) {
      query.isFeatured = true;
    }
    
    if (search) {
      query.$text = { $search: search };
    }
    
    // Sort options
    const sortOptions: Record<string, Record<string, 1 | -1>> = {
      popular: { memberCount: -1 },
      active: { lastActivityAt: -1 },
      newest: { createdAt: -1 },
      alphabetical: { name: 1 },
    };
    
    const [groups, total] = await Promise.all([
      Group.find(query)
        .select('name slug shortDescription description avatar banner type category tags memberCount threadCount location isVerified isFeatured createdAt lastActivityAt')
        .populate('createdBy', 'username avatar')
        .sort(sortOptions[sort] || sortOptions.popular)
        .skip(skip)
        .limit(limit)
        .lean(),
      Group.countDocuments(query),
    ]);
    
    return NextResponse.json({
      success: true,
      data: groups,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching groups:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch groups' },
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
        { success: false, error: 'Please create a forum profile first' },
        { status: 400 }
      );
    }
    
    if (forumUser.isBanned) {
      return NextResponse.json(
        { success: false, error: 'Your account is banned' },
        { status: 403 }
      );
    }
    
    // Check reputation for creating groups
    const MIN_REP_TO_CREATE_GROUP = 50;
    if (forumUser.reputation < MIN_REP_TO_CREATE_GROUP && forumUser.role === 'member') {
      return NextResponse.json(
        { success: false, error: `You need ${MIN_REP_TO_CREATE_GROUP} reputation to create a group` },
        { status: 403 }
      );
    }
    
    const body = await request.json();
    const { 
      name, 
      description, 
      shortDescription,
      avatar,
      banner,
      type = 'public',
      category = 'other',
      tags = [],
      location,
      rules = [],
      settings,
    } = body;
    
    if (!name || !description) {
      return NextResponse.json(
        { success: false, error: 'Name and description are required' },
        { status: 400 }
      );
    }
    
    // Generate slug
    const baseSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    
    // Check slug availability
    let slug = baseSlug;
    let counter = 1;
    while (await Group.findOne({ slug })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
    
    // Convert simple string rules to objects with title/description format
    const formattedRules = rules.map((rule: string | { title: string; description: string }) => {
      if (typeof rule === 'string') {
        return { title: rule, description: '' };
      }
      return rule;
    });

    const group = new Group({
      name,
      slug,
      description,
      shortDescription: shortDescription || description.substring(0, 200),
      avatar,
      banner,
      type,
      category,
      tags: tags.map((t: string) => t.toLowerCase()),
      location,
      createdBy: forumUser._id,
      memberCount: 1,
      members: [{
        userId: forumUser._id,
        role: 'owner',
        joinedAt: new Date(),
      }],
      rules: formattedRules,
      settings: {
        allowMemberInvites: settings?.allowMemberInvites ?? true,
        allowMemberPosts: settings?.allowMemberPosts ?? true,
        requirePostApproval: settings?.requirePostApproval ?? false,
        showMemberList: settings?.showMemberList ?? true,
        allowEvents: settings?.allowEvents ?? true,
        welcomeMessage: settings?.welcomeMessage,
      },
    });
    
    await group.save();
    
    // Update user's following count (auto-follow created group)
    forumUser.followingCount += 1;
    await forumUser.save();
    
    return NextResponse.json({
      success: true,
      data: group,
    });
  } catch (error) {
    console.error('Error creating group:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create group' },
      { status: 500 }
    );
  }
}
