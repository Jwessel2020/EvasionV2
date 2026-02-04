import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * GET /api/analytics/points
 * Returns police stop points for map visualization
 * Uses server-side pagination and filtering for performance
 * 
 * Query params:
 * - bounds: "minLng,minLat,maxLng,maxLat" (required for zoom > 10)
 * - zoom: current map zoom level
 * - limit: max points to return (default 5000)
 * - violationType: "Citation" | "Warning" | etc.
 * - hasAlcohol: "true" | "false"
 * - hasAccident: "true" | "false"
 * - hourStart: 0-23
 * - hourEnd: 0-23
 * - dayOfWeek: 0-6
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const boundsStr = searchParams.get('bounds');
    const zoom = parseInt(searchParams.get('zoom') || '10');
    const noSampling = searchParams.get('noSampling') === 'true';
    const limit = Math.min(parseInt(searchParams.get('limit') || '5000'), noSampling ? 50000 : 10000);
    const violationType = searchParams.get('violationType');
    const hasAlcohol = searchParams.get('hasAlcohol');
    const hasAccident = searchParams.get('hasAccident');
    const hourStart = searchParams.get('hourStart') ? parseInt(searchParams.get('hourStart')!) : null;
    const hourEnd = searchParams.get('hourEnd') ? parseInt(searchParams.get('hourEnd')!) : null;
    const dayOfWeek = searchParams.get('dayOfWeek') ? parseInt(searchParams.get('dayOfWeek')!) : null;

    // Build WHERE conditions
    const conditions: string[] = [];
    const params: (string | number | boolean)[] = [];
    let paramIndex = 1;

    // Bounds filter (required for detailed views)
    if (boundsStr) {
      const bounds = boundsStr.split(',').map(Number);
      if (bounds.length === 4) {
        const [minLng, minLat, maxLng, maxLat] = bounds;
        conditions.push(`latitude >= $${paramIndex++} AND latitude <= $${paramIndex++}`);
        conditions.push(`longitude >= $${paramIndex++} AND longitude <= $${paramIndex++}`);
        params.push(minLat, maxLat, minLng, maxLng);
      }
    }

    // Violation type filter
    if (violationType) {
      conditions.push(`violation_type = $${paramIndex++}`);
      params.push(violationType);
    }

    // Alcohol filter
    if (hasAlcohol === 'true') {
      conditions.push(`alcohol = true`);
    } else if (hasAlcohol === 'false') {
      conditions.push(`alcohol = false`);
    }

    // Accident filter
    if (hasAccident === 'true') {
      conditions.push(`accident = true`);
    } else if (hasAccident === 'false') {
      conditions.push(`accident = false`);
    }

    // Time filters
    if (hourStart !== null && hourEnd !== null) {
      if (hourStart <= hourEnd) {
        conditions.push(`EXTRACT(HOUR FROM stop_time) >= $${paramIndex++} AND EXTRACT(HOUR FROM stop_time) <= $${paramIndex++}`);
        params.push(hourStart, hourEnd);
      } else {
        conditions.push(`(EXTRACT(HOUR FROM stop_time) >= $${paramIndex++} OR EXTRACT(HOUR FROM stop_time) <= $${paramIndex++})`);
        params.push(hourStart, hourEnd);
      }
    }

    if (dayOfWeek !== null) {
      conditions.push(`EXTRACT(DOW FROM stop_date) = $${paramIndex++}`);
      params.push(dayOfWeek);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Determine sampling rate based on zoom level
    // Use a hash-based approach for consistent spatial distribution
    // At low zooms, use spatial grid sampling for even distribution
    let samplingClause = '';
    let dynamicLimit = limit;
    
    // Skip sampling if noSampling is requested (show all points mode)
    if (!noSampling) {
      if (zoom < 6) {
        // Very zoomed out - sparse, evenly distributed sample
        samplingClause = 'AND MOD(ABS(HASHTEXT(id::text)), 500) = 0'; // ~0.2%
        dynamicLimit = 2000;
      } else if (zoom < 8) {
        samplingClause = 'AND MOD(ABS(HASHTEXT(id::text)), 200) = 0'; // ~0.5%
        dynamicLimit = 3000;
      } else if (zoom < 10) {
        samplingClause = 'AND MOD(ABS(HASHTEXT(id::text)), 50) = 0'; // ~2%
        dynamicLimit = 5000;
      } else if (zoom < 11) {
        samplingClause = 'AND MOD(ABS(HASHTEXT(id::text)), 20) = 0'; // ~5%
        dynamicLimit = 6000;
      } else if (zoom < 12) {
        samplingClause = 'AND MOD(ABS(HASHTEXT(id::text)), 8) = 0'; // ~12.5%
        dynamicLimit = 8000;
      } else if (zoom < 13) {
        samplingClause = 'AND MOD(ABS(HASHTEXT(id::text)), 4) = 0'; // ~25%
        dynamicLimit = 10000;
      }
      // zoom >= 13: no sampling, show all points in view
    }
    // noSampling = true: return all points up to limit (for "show all" mode)

    const query = `
      SELECT 
        id,
        latitude as lat,
        longitude as lng,
        violation_type,
        description,
        sub_agency,
        stop_date,
        stop_time,
        alcohol,
        accident,
        vehicle_make,
        vehicle_model,
        vehicle_year
      FROM traffic_violations
      ${whereClause}
      ${samplingClause ? (whereClause ? samplingClause : 'WHERE ' + samplingClause.substring(4)) : ''}
      LIMIT $${paramIndex}
    `;
    params.push(dynamicLimit);

    const results = await prisma.$queryRawUnsafe<Array<{
      id: string;
      lat: number;
      lng: number;
      violation_type: string | null;
      description: string | null;
      sub_agency: string | null;
      stop_date: Date;
      stop_time: Date;
      alcohol: boolean;
      accident: boolean;
      vehicle_make: string | null;
      vehicle_model: string | null;
      vehicle_year: number | null;
    }>>(query, ...params);

    // Format as GeoJSON for Mapbox
    const features = results.map(r => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [r.lng, r.lat],
      },
      properties: {
        id: r.id,
        violationType: r.violation_type || 'Unknown',
        description: r.description,
        subAgency: r.sub_agency,
        date: r.stop_date,
        time: r.stop_time,
        alcohol: r.alcohol,
        accident: r.accident,
        vehicle: r.vehicle_make 
          ? `${r.vehicle_year || ''} ${r.vehicle_make} ${r.vehicle_model || ''}`.trim()
          : null,
      },
    }));

    return NextResponse.json({
      success: true,
      data: {
        type: 'FeatureCollection',
        features,
      },
      meta: {
        count: features.length,
        zoom,
        limit,
        filters: {
          violationType,
          hasAlcohol,
          hasAccident,
          hourStart,
          hourEnd,
          dayOfWeek,
        },
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '';
    if (errorMessage.includes('does not exist') || errorMessage.includes('relation')) {
      return NextResponse.json({
        success: true,
        data: { type: 'FeatureCollection', features: [] },
        meta: { count: 0, message: 'No data yet. Run db:import to load data.' },
      });
    }
    
    console.error('Error fetching points:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch points' },
      { status: 500 }
    );
  }
}
