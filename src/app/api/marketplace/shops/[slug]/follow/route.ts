import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { Shop } from '@/models/marketplace';
import { ForumUser, Follow, Notification } from '@/models/forum';
import { createServerSupabaseClient } from '@/lib/supabase/server';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

/**
 * POST /api/marketplace/shops/[slug]/follow - Follow a shop
 * DELETE /api/marketplace/shops/[slug]/follow - Unfollow a shop
 */

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params;
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
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const shop = await Shop.findOne({ slug });
    if (!shop) {
      return NextResponse.json(
        { success: false, error: 'Shop not found' },
        { status: 404 }
      );
    }

    if (shop.status !== 'active') {
      return NextResponse.json(
        { success: false, error: 'Cannot follow an inactive shop' },
        { status: 400 }
      );
    }

    // Can't follow your own shop
    if (shop.owner.toString() === forumUser._id.toString()) {
      return NextResponse.json(
        { success: false, error: 'You cannot follow your own shop' },
        { status: 400 }
      );
    }

    // Check if already following
    const existingFollow = await Follow.findOne({
      follower: forumUser._id,
      targetShop: shop._id,
      targetType: 'shop',
    });

    if (existingFollow) {
      return NextResponse.json(
        { success: false, error: 'You are already following this shop' },
        { status: 400 }
      );
    }

    // Create follow
    await Follow.create({
      follower: forumUser._id,
      targetShop: shop._id,
      targetType: 'shop',
    });

    // Update shop follower count
    await Shop.findByIdAndUpdate(shop._id, { $inc: { followerCount: 1 } });

    // Notify shop owner
    await Notification.create({
      recipient: shop.owner,
      type: 'new_follower',
      message: `${forumUser.username} started following your shop ${shop.name}`,
      data: {
        userId: forumUser._id,
        username: forumUser.username,
        userAvatar: forumUser.avatar,
        shopId: shop._id,
        shopName: shop.name,
        shopSlug: shop.slug,
      },
    });

    return NextResponse.json({
      success: true,
      following: true,
      message: `You are now following ${shop.name}`,
    });
  } catch (error) {
    console.error('Error following shop:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to follow shop' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params;
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
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const shop = await Shop.findOne({ slug });
    if (!shop) {
      return NextResponse.json(
        { success: false, error: 'Shop not found' },
        { status: 404 }
      );
    }

    // Delete follow
    const deleted = await Follow.findOneAndDelete({
      follower: forumUser._id,
      targetShop: shop._id,
      targetType: 'shop',
    });

    if (deleted) {
      // Update shop follower count
      await Shop.findByIdAndUpdate(shop._id, { $inc: { followerCount: -1 } });
    }

    return NextResponse.json({
      success: true,
      following: false,
      message: `You unfollowed ${shop.name}`,
    });
  } catch (error) {
    console.error('Error unfollowing shop:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to unfollow shop' },
      { status: 500 }
    );
  }
}
