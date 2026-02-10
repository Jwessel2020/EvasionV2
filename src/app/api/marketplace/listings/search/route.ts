import { NextRequest, NextResponse } from 'next/server';
import { PipelineStage } from 'mongoose';
import connectDB from '@/lib/mongodb';
import { Listing } from '@/models/marketplace';

/**
 * GET /api/marketplace/listings/search - Advanced search with aggregation
 */
export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const category = searchParams.get('category');
    const condition = searchParams.get('condition');
    const minPrice = searchParams.get('minPrice');
    const maxPrice = searchParams.get('maxPrice');
    const state = searchParams.get('state');
    const make = searchParams.get('make');
    const model = searchParams.get('model');
    const yearMin = searchParams.get('yearMin');
    const yearMax = searchParams.get('yearMax');
    const freeShipping = searchParams.get('freeShipping') === 'true';
    const localPickup = searchParams.get('localPickup') === 'true';
    const sort = searchParams.get('sort') || 'relevant';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '24'), 50);

    // Build aggregation pipeline
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pipeline: any[] = [];

    // Text search stage (must be first if using $text)
    if (query) {
      pipeline.push({
        $match: {
          $text: { $search: query },
          status: 'active',
        },
      });
      pipeline.push({
        $addFields: { textScore: { $meta: 'textScore' } },
      });
    } else {
      pipeline.push({
        $match: { status: 'active' },
      });
    }

    // Additional filters
    const matchStage: Record<string, unknown> = {};

    if (category) {
      matchStage.category = category;
    }

    if (condition) {
      matchStage.condition = { $in: condition.split(',') };
    }

    if (minPrice || maxPrice) {
      matchStage.price = {};
      if (minPrice) (matchStage.price as Record<string, number>).$gte = parseFloat(minPrice);
      if (maxPrice) (matchStage.price as Record<string, number>).$lte = parseFloat(maxPrice);
    }

    if (state) {
      matchStage['location.state'] = state;
    }

    if (freeShipping) {
      matchStage['shipping.freeShipping'] = true;
    }

    if (localPickup) {
      matchStage['shipping.localPickup'] = true;
    }

    // Vehicle compatibility filters
    if (make || model || yearMin || yearMax) {
      const vehicleFilters: Record<string, unknown>[] = [
        { 'compatibility.universal': true },
      ];

      const vehicleMatch: Record<string, unknown> = {};

      if (make) {
        vehicleMatch['compatibility.vehicles.make'] = { $regex: new RegExp(`^${make}$`, 'i') };
      }

      if (model) {
        vehicleMatch['compatibility.vehicles.model'] = { $regex: new RegExp(`^${model}$`, 'i') };
      }

      if (yearMin || yearMax) {
        const yearConditions: Record<string, unknown>[] = [];

        // Match exact year
        if (yearMin && yearMax) {
          yearConditions.push({
            'compatibility.vehicles.year': {
              $gte: parseInt(yearMin),
              $lte: parseInt(yearMax),
            },
          });
        } else if (yearMin) {
          yearConditions.push({
            $or: [
              { 'compatibility.vehicles.year': { $gte: parseInt(yearMin) } },
              { 'compatibility.vehicles.yearMax': { $gte: parseInt(yearMin) } },
            ],
          });
        } else if (yearMax) {
          yearConditions.push({
            $or: [
              { 'compatibility.vehicles.year': { $lte: parseInt(yearMax) } },
              { 'compatibility.vehicles.yearMin': { $lte: parseInt(yearMax) } },
            ],
          });
        }

        if (yearConditions.length > 0) {
          Object.assign(vehicleMatch, ...yearConditions);
        }
      }

      if (Object.keys(vehicleMatch).length > 0) {
        vehicleFilters.push(vehicleMatch);
      }

      matchStage.$or = vehicleFilters;
    }

    if (Object.keys(matchStage).length > 0) {
      pipeline.push({ $match: matchStage });
    }

    // Sorting
    const sortStages: Record<string, Record<string, unknown>> = {
      relevant: { textScore: -1, isFeatured: -1, createdAt: -1 },
      newest: { isFeatured: -1, createdAt: -1 },
      oldest: { createdAt: 1 },
      priceAsc: { isFeatured: -1, price: 1 },
      priceDesc: { isFeatured: -1, price: -1 },
      popular: { isFeatured: -1, viewCount: -1 },
    };

    const selectedSort = query ? sortStages[sort] || sortStages.relevant : sortStages[sort] || sortStages.newest;

    // Remove textScore sort if no query
    if (!query && selectedSort.textScore) {
      delete selectedSort.textScore;
    }

    pipeline.push({ $sort: selectedSort });

    // Facet for pagination and results
    pipeline.push({
      $facet: {
        results: [
          { $skip: (page - 1) * limit },
          { $limit: limit },
          {
            $project: {
              title: 1,
              slug: 1,
              price: 1,
              originalPrice: 1,
              condition: 1,
              category: 1,
              images: { $slice: ['$images', 1] },
              sellerUsername: 1,
              shopName: 1,
              'location.state': 1,
              'location.city': 1,
              'shipping.freeShipping': 1,
              'shipping.localPickup': 1,
              isFeatured: 1,
              viewCount: 1,
              saveCount: 1,
              createdAt: 1,
              textScore: 1,
            },
          },
        ],
        totalCount: [{ $count: 'count' }],
        // Category breakdown for filters
        categories: [
          { $group: { _id: '$category', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ],
        // Condition breakdown for filters
        conditions: [
          { $group: { _id: '$condition', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ],
        // State breakdown for filters
        states: [
          { $group: { _id: '$location.state', count: { $sum: 1 } } },
          { $match: { _id: { $ne: null } } },
          { $sort: { count: -1 } },
          { $limit: 20 },
        ],
        // Price range
        priceRange: [
          {
            $group: {
              _id: null,
              min: { $min: '$price' },
              max: { $max: '$price' },
              avg: { $avg: '$price' },
            },
          },
        ],
      },
    });

    const [result] = await Listing.aggregate(pipeline);

    const total = result.totalCount[0]?.count || 0;

    return NextResponse.json({
      success: true,
      data: result.results,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      facets: {
        categories: result.categories,
        conditions: result.conditions,
        states: result.states,
        priceRange: result.priceRange[0] || { min: 0, max: 0, avg: 0 },
      },
    });
  } catch (error) {
    console.error('Error searching listings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to search listings' },
      { status: 500 }
    );
  }
}
