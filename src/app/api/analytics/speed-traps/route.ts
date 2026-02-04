import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * GET /api/analytics/speed-traps
 * Returns identified speed trap locations based on:
 * - High concentration of speed stops at same location
 * - Use of stationary detection methods (radar, laser)
 * - Consistent enforcement patterns
 * 
 * Query params:
 * - bounds: "minLng,minLat,maxLng,maxLat" (optional)
 * - minStops: minimum stops at location to be considered a trap (default 5)
 * - year: filter by year
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const boundsStr = searchParams.get('bounds');
    const minStops = parseInt(searchParams.get('minStops') || '5');
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : null;
    const limit = Math.min(parseInt(searchParams.get('limit') || '500'), 1000);

    // Build WHERE conditions
    const conditions: string[] = [
      'is_speed_related = true',
      // Stationary detection methods (speed trap indicators)
      `(
        arrest_type LIKE 'E -%' OR 
        arrest_type LIKE 'F -%' OR 
        arrest_type LIKE 'G -%' OR 
        arrest_type LIKE 'H -%' OR 
        arrest_type LIKE 'Q -%' OR 
        arrest_type LIKE 'R -%'
      )`,
      'latitude != 0',
      'longitude != 0',
    ];
    const params: (string | number)[] = [];
    let paramIndex = 1;

    // Bounds filter
    if (boundsStr) {
      const bounds = boundsStr.split(',').map(Number);
      if (bounds.length === 4) {
        const [minLng, minLat, maxLng, maxLat] = bounds;
        conditions.push(`latitude >= $${paramIndex++} AND latitude <= $${paramIndex++}`);
        conditions.push(`longitude >= $${paramIndex++} AND longitude <= $${paramIndex++}`);
        params.push(minLat, maxLat, minLng, maxLng);
      }
    }

    // Year filter
    if (year !== null) {
      conditions.push(`EXTRACT(YEAR FROM stop_date) = $${paramIndex++}`);
      params.push(year);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // Query to find speed trap hotspots
    // Groups by rounded lat/lng (3 decimal places ≈ 100m precision)
    const query = `
      WITH location_stats AS (
        SELECT 
          ROUND(latitude::numeric, 3) as grid_lat,
          ROUND(longitude::numeric, 3) as grid_lng,
          COUNT(*) as stop_count,
          COUNT(DISTINCT DATE(stop_date)) as unique_days,
          MODE() WITHIN GROUP (ORDER BY location) as common_location,
          MODE() WITHIN GROUP (ORDER BY sub_agency) as district,
          AVG(speed_over) as avg_speed_over,
          MAX(speed_over) as max_speed_over,
          MODE() WITHIN GROUP (ORDER BY detection_method) as primary_method,
          ARRAY_AGG(DISTINCT EXTRACT(HOUR FROM stop_time)::int) as active_hours,
          MIN(stop_date) as first_stop,
          MAX(stop_date) as last_stop
        FROM traffic_violations
        ${whereClause}
        GROUP BY ROUND(latitude::numeric, 3), ROUND(longitude::numeric, 3)
        HAVING COUNT(*) >= $${paramIndex}
      )
      SELECT 
        grid_lat as lat,
        grid_lng as lng,
        stop_count,
        unique_days,
        common_location as location,
        district,
        avg_speed_over,
        max_speed_over,
        primary_method,
        active_hours,
        first_stop,
        last_stop,
        -- Calculate a "trap score" based on various factors
        (
          (stop_count::float / GREATEST(unique_days, 1)) * 10 + -- Frequency score
          CASE WHEN primary_method IN ('radar', 'laser') THEN 20 ELSE 5 END + -- Method score
          CASE WHEN avg_speed_over > 15 THEN 10 ELSE 0 END -- High speed area bonus
        ) as trap_score
      FROM location_stats
      ORDER BY trap_score DESC, stop_count DESC
      LIMIT $${paramIndex + 1}
    `;
    params.push(minStops, limit);

    const results = await prisma.$queryRawUnsafe<Array<{
      lat: number;
      lng: number;
      stop_count: bigint;
      unique_days: bigint;
      location: string | null;
      district: string | null;
      avg_speed_over: number | null;
      max_speed_over: number | null;
      primary_method: string | null;
      active_hours: number[];
      first_stop: Date;
      last_stop: Date;
      trap_score: number;
    }>>(query, ...params);

    // Format as GeoJSON
    const features = results.map(r => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [Number(r.lng), Number(r.lat)],
      },
      properties: {
        stopCount: Number(r.stop_count),
        uniqueDays: Number(r.unique_days),
        location: r.location,
        district: r.district,
        avgSpeedOver: r.avg_speed_over ? Math.round(r.avg_speed_over) : null,
        maxSpeedOver: r.max_speed_over,
        primaryMethod: r.primary_method,
        activeHours: r.active_hours,
        firstStop: r.first_stop,
        lastStop: r.last_stop,
        trapScore: Math.round(r.trap_score),
        // Calculate intensity for visualization (0-1)
        intensity: Math.min(Number(r.stop_count) / 100, 1),
      },
    }));

    // Calculate summary stats
    const totalTraps = features.length;
    const totalStops = features.reduce((sum, f) => sum + (f.properties.stopCount || 0), 0);
    const avgStopsPerTrap = totalTraps > 0 ? Math.round(totalStops / totalTraps) : 0;

    // Get top methods
    const methodCounts: Record<string, number> = {};
    features.forEach(f => {
      const method = f.properties.primaryMethod || 'unknown';
      methodCounts[method] = (methodCounts[method] || 0) + 1;
    });

    return NextResponse.json({
      success: true,
      data: {
        type: 'FeatureCollection',
        features,
      },
      meta: {
        totalTraps,
        totalStops,
        avgStopsPerTrap,
        methodBreakdown: methodCounts,
        minStopsThreshold: minStops,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '';
    if (errorMessage.includes('does not exist') || errorMessage.includes('relation')) {
      return NextResponse.json({
        success: true,
        data: { type: 'FeatureCollection', features: [] },
        meta: { totalTraps: 0, message: 'No data yet. Run db:import to load data.' },
      });
    }
    
    console.error('Error fetching speed traps:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch speed traps' },
      { status: 500 }
    );
  }
}
