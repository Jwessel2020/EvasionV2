import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { Board, ForumUser } from '@/models/forum';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * GET /api/forum/boards - Get all boards
 * POST /api/forum/boards - Create a new board (user-created)
 */

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 'category', 'board', 'user-created'
    const parentId = searchParams.get('parent');
    const search = searchParams.get('search');
    
    // Build query
    const query: Record<string, unknown> = { 
      isArchived: false,
      'settings.isPrivate': false, // Only public boards
    };
    
    if (type) {
      query.type = type;
    }
    
    if (parentId) {
      query.parentBoard = parentId;
    } else if (!search) {
      // If no parent specified and not searching, get top-level boards
      query.parentBoard = { $exists: false };
    }
    
    if (search) {
      query.$text = { $search: search };
    }
    
    const boards = await Board.find(query)
      .populate('parentBoard', 'name slug')
      .populate('lastPostBy', 'username avatar')
      .sort({ order: 1, name: 1 })
      .lean();
    
    // Get sub-boards for each board
    const boardsWithSubs = await Promise.all(
      boards.map(async (board) => {
        const subBoards = await Board.find({ parentBoard: board._id, isArchived: false })
          .select('name slug threadCount postCount')
          .sort({ order: 1 })
          .lean();
        return { ...board, subBoards };
      })
    );
    
    return NextResponse.json({
      success: true,
      data: boardsWithSubs,
    });
  } catch (error) {
    console.error('Error fetching boards:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch boards' },
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
    
    // Check reputation for creating boards
    const MIN_REP_TO_CREATE_BOARD = 100;
    if (forumUser.reputation < MIN_REP_TO_CREATE_BOARD && forumUser.role === 'member') {
      return NextResponse.json(
        { success: false, error: `You need ${MIN_REP_TO_CREATE_BOARD} reputation to create a board` },
        { status: 403 }
      );
    }
    
    const body = await request.json();
    const { name, description, icon, color, parentBoard, settings } = body;
    
    if (!name || !description) {
      return NextResponse.json(
        { success: false, error: 'Name and description are required' },
        { status: 400 }
      );
    }
    
    // Generate slug
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    
    // Check slug availability
    const existing = await Board.findOne({ slug });
    if (existing) {
      return NextResponse.json(
        { success: false, error: 'A board with this name already exists' },
        { status: 400 }
      );
    }
    
    const board = new Board({
      name,
      slug,
      description,
      icon,
      color,
      parentBoard,
      type: 'user-created',
      createdBy: forumUser._id,
      moderators: [forumUser._id],
      settings: {
        isPrivate: settings?.isPrivate || false,
        requireApproval: settings?.requireApproval || false,
        allowPolls: true,
        allowImages: true,
        allowVideos: true,
        minRepToPost: 0,
        minRepToCreate: 0,
      },
    });
    
    await board.save();
    
    return NextResponse.json({
      success: true,
      data: board,
    });
  } catch (error) {
    console.error('Error creating board:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create board' },
      { status: 500 }
    );
  }
}
