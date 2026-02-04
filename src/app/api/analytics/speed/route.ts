import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * GET /api/analytics/speed
 * Returns speed-related violation data and statistics
 * 
 * Query params:
 * - bounds: "minLng,minLat,maxLng,maxLat" (optional, for map view)
 * - zoom: current map zoom level
 * - detectionMethod: "radar" | "laser" | "vascar" | "patrol" | "all"
 * - minSpeedOver: minimum speed over limit (parsed from description)
 * - timeOfDay: "morning" | "afternoon" | "evening" | "night"
 * - dayOfWeek: 0-6 (Sunday = 0)
 * - limit: max records (default 5000)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const boundsStr = searchParams.get('bounds');
    const zoom = parseInt(searchParams.get('zoom') || '10');
    const detectionMethod = searchParams.get('detectionMethod') || 'all';
    const timeOfDay = searchParams.get('timeOfDay');
    const dayOfWeek = searchParams.get('dayOfWeek');
    const limit = Math.min(parseInt(searchParams.get('limit') || '5000'), 20000);
    const statsOnly = searchParams.get('statsOnly') === 'true';

    // Build WHERE conditions - filter for speed violations (21-801*)
    const conditions: string[] = ['charge LIKE \'21-801%\''];
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

    // Detection method filter (based on arrest_type)
    if (detectionMethod && detectionMethod !== 'all') {
      const arrestTypeCodes = getArrestTypeCodes(detectionMethod);
      if (arrestTypeCodes.length > 0) {
        const placeholders = arrestTypeCodes.map(() => `$${paramIndex++}`).join(', ');
        conditions.push(`arrest_type IN (${placeholders})`);
        params.push(...arrestTypeCodes);
      }
    }

    // Time of day filter
    if (timeOfDay) {
      const [hourStart, hourEnd] = getTimeOfDayRange(timeOfDay);
      if (hourStart <= hourEnd) {
        conditions.push(`EXTRACT(HOUR FROM stop_time) >= $${paramIndex++} AND EXTRACT(HOUR FROM stop_time) <= $${paramIndex++}`);
        params.push(hourStart, hourEnd);
      } else {
        // Overnight range (e.g., 22-5)
        conditions.push(`(EXTRACT(HOUR FROM stop_time) >= $${paramIndex++} OR EXTRACT(HOUR FROM stop_time) <= $${paramIndex++})`);
        params.push(hourStart, hourEnd);
      }
    }

    // Day of week filter
    if (dayOfWeek !== null && dayOfWeek !== undefined && dayOfWeek !== '') {
      conditions.push(`EXTRACT(DOW FROM stop_date) = $${paramIndex++}`);
      params.push(parseInt(dayOfWeek));
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // If stats only, return aggregated statistics
    if (statsOnly) {
      const stats = await getSpeedStats(whereClause, params);
      return NextResponse.json({ success: true, data: stats });
    }

    // Sampling based on zoom level for performance
    let samplingClause = '';
    if (zoom < 8) {
      samplingClause = `AND MOD(ABS(HASHTEXT(id::text)), 100) = 0`; // 1%
    } else if (zoom < 10) {
      samplingClause = `AND MOD(ABS(HASHTEXT(id::text)), 20) = 0`; // 5%
    } else if (zoom < 12) {
      samplingClause = `AND MOD(ABS(HASHTEXT(id::text)), 5) = 0`; // 20%
    }

    // Query for points
    const query = `
      SELECT 
        id,
        latitude as lat,
        longitude as lng,
        description,
        charge,
        arrest_type,
        violation_type,
        stop_date,
        stop_time,
        vehicle_make,
        vehicle_model,
        vehicle_year,
        sub_agency
      FROM traffic_violations
      ${whereClause}
      ${samplingClause}
      ORDER BY stop_date DESC, stop_time DESC
      LIMIT $${paramIndex}
    `;
    params.push(limit);

    const results = await prisma.$queryRawUnsafe<Array<{
      id: string;
      lat: number;
      lng: number;
      description: string | null;
      charge: string | null;
      arrest_type: string | null;
      violation_type: string | null;
      stop_date: Date;
      stop_time: Date;
      vehicle_make: string | null;
      vehicle_model: string | null;
      vehicle_year: number | null;
      sub_agency: string | null;
    }>>(query, ...params);

    // Parse speed info and format as GeoJSON
    const features = results.map(r => {
      const speedInfo = parseSpeedFromDescription(r.description);
      return {
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [r.lng, r.lat],
        },
        properties: {
          id: r.id,
          description: r.description,
          charge: r.charge,
          arrestType: r.arrest_type,
          detectionMethod: categorizeArrestType(r.arrest_type),
          violationType: r.violation_type,
          date: r.stop_date,
          time: r.stop_time,
          vehicle: r.vehicle_make 
            ? `${r.vehicle_year || ''} ${r.vehicle_make} ${r.vehicle_model || ''}`.trim()
            : null,
          subAgency: r.sub_agency,
          ...speedInfo,
        },
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        type: 'FeatureCollection',
        features,
      },
      meta: {
        count: features.length,
        zoom,
        detectionMethod,
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
    
    console.error('Error fetching speed violations:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch speed violations' },
      { status: 500 }
    );
  }
}

/**
 * Get arrest type codes for a detection method category
 */
function getArrestTypeCodes(method: string): string[] {
  const categories: Record<string, string[]> = {
    radar: [
      'E - Marked Stationary Radar',
      'F - Unmarked Stationary Radar',
      'G - Marked Moving Radar (Stationary)',
      'H - Unmarked Moving Radar (Stationary)',
      'I - Marked Moving Radar (Moving)',
      'J - Unmarked Moving Radar (Moving)',
    ],
    laser: [
      'Q - Marked Laser',
      'R - Unmarked Laser',
    ],
    vascar: [
      'C - Marked VASCAR',
      'D - Unmarked VASCAR',
    ],
    patrol: [
      'A - Marked Patrol',
      'B - Unmarked Patrol',
      'L - Motorcycle',
      'M - Marked (Off-Duty)',
      'N - Unmarked (Off-Duty)',
      'O - Foot Patrol',
      'P - Mounted Patrol',
    ],
    automated: [
      'S - License Plate Recognition',
    ],
  };
  
  return categories[method] || [];
}

/**
 * Categorize arrest type into detection method
 */
function categorizeArrestType(arrestType: string | null): string {
  if (!arrestType) return 'unknown';
  
  const code = arrestType.charAt(0).toUpperCase();
  
  if (['E', 'F', 'G', 'H', 'I', 'J'].includes(code)) return 'radar';
  if (['Q', 'R'].includes(code)) return 'laser';
  if (['C', 'D'].includes(code)) return 'vascar';
  if (['A', 'B', 'L', 'M', 'N', 'O', 'P'].includes(code)) return 'patrol';
  if (code === 'S') return 'automated';
  
  return 'unknown';
}

/**
 * Get hour range for time of day
 */
function getTimeOfDayRange(timeOfDay: string): [number, number] {
  switch (timeOfDay) {
    case 'morning': return [6, 11];      // 6 AM - 11 AM
    case 'afternoon': return [12, 17];   // 12 PM - 5 PM
    case 'evening': return [18, 21];     // 6 PM - 9 PM
    case 'night': return [22, 5];        // 10 PM - 5 AM (overnight)
    default: return [0, 23];
  }
}

/**
 * Parse speed information from description field
 * Handles formats like:
 * - "EXCEEDING POSTED MAXIMUM SPEED LIMIT: 84 MPH IN A POSTED 55 MPH ZONE"
 * - "DRIVING VEHICLE IN EXCESS OF REASONABLE AND PRUDENT SPEED ON HIGHWAY 100/55"
 * - "75 IN 45"
 */
function parseSpeedFromDescription(description: string | null): {
  recordedSpeed: number | null;
  postedLimit: number | null;
  speedOver: number | null;
} {
  if (!description) {
    return { recordedSpeed: null, postedLimit: null, speedOver: null };
  }

  let recordedSpeed: number | null = null;
  let postedLimit: number | null = null;

  // Pattern 1: "84 MPH IN A POSTED 55 MPH ZONE" or "84 MPH IN A POSTED 55 MPH"
  const pattern1 = /(\d{2,3})\s*MPH\s*IN\s*(?:A\s*)?(?:POSTED\s*)?(\d{2,3})\s*MPH/i;
  const match1 = description.match(pattern1);
  if (match1) {
    recordedSpeed = parseInt(match1[1]);
    postedLimit = parseInt(match1[2]);
  }

  // Pattern 2: "100/55" or "100 IN 55"
  if (!recordedSpeed) {
    const pattern2 = /(\d{2,3})\s*[\/IN]\s*(\d{2,3})/i;
    const match2 = description.match(pattern2);
    if (match2) {
      recordedSpeed = parseInt(match2[1]);
      postedLimit = parseInt(match2[2]);
    }
  }

  // Pattern 3: "POSTED SPEED LIMIT OF 55 MPH" (only limit, often in warnings)
  if (!postedLimit) {
    const pattern3 = /(?:POSTED\s*)?(?:SPEED\s*)?LIMIT\s*(?:OF\s*)?(\d{2,3})\s*MPH/i;
    const match3 = description.match(pattern3);
    if (match3) {
      postedLimit = parseInt(match3[1]);
    }
  }

  // Pattern 4: Just a speed at the end like "HIGHWAY 75"
  if (!recordedSpeed && !postedLimit) {
    const pattern4 = /HIGHWAY\s*(\d{2,3})(?:\s*MPH)?$/i;
    const match4 = description.match(pattern4);
    if (match4) {
      recordedSpeed = parseInt(match4[1]);
    }
  }

  const speedOver = (recordedSpeed && postedLimit) ? recordedSpeed - postedLimit : null;

  return { recordedSpeed, postedLimit, speedOver };
}

/**
 * Get aggregated statistics for speed violations
 */
async function getSpeedStats(whereClause: string, params: (string | number)[]) {
  // Total speed stops
  const totalQuery = `SELECT COUNT(*) as count FROM traffic_violations ${whereClause}`;
  const totalResult = await prisma.$queryRawUnsafe<[{ count: bigint }]>(totalQuery, ...params);
  const totalStops = Number(totalResult[0]?.count || 0);

  // By detection method
  const byMethodQuery = `
    SELECT 
      CASE 
        WHEN LEFT(arrest_type, 1) IN ('E', 'F', 'G', 'H', 'I', 'J') THEN 'Radar'
        WHEN LEFT(arrest_type, 1) IN ('Q', 'R') THEN 'Laser'
        WHEN LEFT(arrest_type, 1) IN ('C', 'D') THEN 'VASCAR'
        WHEN LEFT(arrest_type, 1) IN ('A', 'B', 'L', 'M', 'N', 'O', 'P') THEN 'Patrol'
        WHEN LEFT(arrest_type, 1) = 'S' THEN 'Automated'
        ELSE 'Unknown'
      END as method,
      COUNT(*) as count
    FROM traffic_violations
    ${whereClause}
    GROUP BY method
    ORDER BY count DESC
  `;
  const byMethod = await prisma.$queryRawUnsafe<Array<{ method: string; count: bigint }>>(byMethodQuery, ...params);

  // By hour of day
  const byHourQuery = `
    SELECT 
      EXTRACT(HOUR FROM stop_time) as hour,
      COUNT(*) as count
    FROM traffic_violations
    ${whereClause}
    GROUP BY hour
    ORDER BY hour
  `;
  const byHour = await prisma.$queryRawUnsafe<Array<{ hour: number; count: bigint }>>(byHourQuery, ...params);

  // By day of week
  const byDayQuery = `
    SELECT 
      EXTRACT(DOW FROM stop_date) as day,
      COUNT(*) as count
    FROM traffic_violations
    ${whereClause}
    GROUP BY day
    ORDER BY day
  `;
  const byDay = await prisma.$queryRawUnsafe<Array<{ day: number; count: bigint }>>(byDayQuery, ...params);

  // Top locations (sub_agency)
  const topLocationsQuery = `
    SELECT 
      sub_agency as location,
      COUNT(*) as count
    FROM traffic_violations
    ${whereClause}
    AND sub_agency IS NOT NULL
    GROUP BY sub_agency
    ORDER BY count DESC
    LIMIT 10
  `;
  const topLocations = await prisma.$queryRawUnsafe<Array<{ location: string; count: bigint }>>(topLocationsQuery, ...params);

  // Top vehicle makes
  const topVehiclesQuery = `
    SELECT 
      vehicle_make as make,
      COUNT(*) as count
    FROM traffic_violations
    ${whereClause}
    AND vehicle_make IS NOT NULL
    GROUP BY vehicle_make
    ORDER BY count DESC
    LIMIT 10
  `;
  const topVehicles = await prisma.$queryRawUnsafe<Array<{ make: string; count: bigint }>>(topVehiclesQuery, ...params);

  return {
    totalStops,
    byMethod: byMethod.map(r => ({ method: r.method, count: Number(r.count) })),
    byHour: byHour.map(r => ({ hour: Number(r.hour), count: Number(r.count) })),
    byDay: byDay.map(r => ({ day: Number(r.day), count: Number(r.count) })),
    topLocations: topLocations.map(r => ({ location: r.location, count: Number(r.count) })),
    topVehicles: topVehicles.map(r => ({ make: r.make, count: Number(r.count) })),
  };
}
