import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * GET /api/insights/route-risk
 * Returns enforcement risk assessment for road corridors
 *
 * Query params:
 * - bounds: "minLng,minLat,maxLng,maxLat" (optional, filters to viewport)
 * - limit: Maximum corridors to return (default 20, max 50)
 *
 * Also available: GET /api/insights/route-risk/top
 * Returns the top high-risk corridors system-wide
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse optional bounds
    const boundsStr = searchParams.get('bounds');
    let boundsClause = '';

    if (boundsStr) {
      const bounds = boundsStr.split(',').map(Number);
      if (bounds.length === 4 && !bounds.some(isNaN)) {
        const [minLng, minLat, maxLng, maxLat] = bounds;
        boundsClause = `
          AND latitude >= ${minLat}
          AND latitude <= ${maxLat}
          AND longitude >= ${minLng}
          AND longitude <= ${maxLng}
        `;
      }
    }

    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);

    // Query for corridor analysis
    // Group by latitude bands (corridors) and get enforcement density
    const [corridorData, overallStats, timeWindowData] = await Promise.all([
      // Query 1: Corridor analysis (grouped by latitude strips for E-W roads)
      prisma.$queryRawUnsafe<Array<{
        corridor_lat: number;
        lng_range_start: number;
        lng_range_end: number;
        total_stops: bigint;
        unique_locations: bigint;
        avg_speed_over: number;
        dominant_method: string;
      }>>(`
        SELECT
          ROUND(latitude::numeric, 2) as corridor_lat,
          MIN(longitude) as lng_range_start,
          MAX(longitude) as lng_range_end,
          COUNT(*) as total_stops,
          COUNT(DISTINCT ROUND(longitude::numeric, 3)) as unique_locations,
          ROUND(AVG(speed_over)::numeric, 1) as avg_speed_over,
          MODE() WITHIN GROUP (ORDER BY detection_method) as dominant_method
        FROM traffic_violations
        WHERE latitude IS NOT NULL
          AND longitude IS NOT NULL
          ${boundsClause}
        GROUP BY corridor_lat
        HAVING COUNT(*) >= 50
        ORDER BY total_stops DESC
        LIMIT ${limit}
      `),

      // Query 2: Overall statistics for comparison
      prisma.$queryRaw<Array<{
        total_violations: bigint;
        avg_stops_per_corridor: number;
      }>>`
        SELECT
          COUNT(*) as total_violations,
          COUNT(*)::numeric / COUNT(DISTINCT ROUND(latitude::numeric, 2)) as avg_stops_per_corridor
        FROM traffic_violations
        WHERE latitude IS NOT NULL
      `,

      // Query 3: Time windows for top corridors
      prisma.$queryRawUnsafe<Array<{
        corridor_lat: number;
        day_num: number;
        hour: number;
        count: bigint;
      }>>(`
        WITH top_corridors AS (
          SELECT ROUND(latitude::numeric, 2) as corridor_lat
          FROM traffic_violations
          WHERE latitude IS NOT NULL ${boundsClause}
          GROUP BY corridor_lat
          HAVING COUNT(*) >= 50
          ORDER BY COUNT(*) DESC
          LIMIT 10
        )
        SELECT
          ROUND(tv.latitude::numeric, 2) as corridor_lat,
          EXTRACT(DOW FROM tv.stop_date)::int as day_num,
          EXTRACT(HOUR FROM tv.stop_time)::int as hour,
          COUNT(*) as count
        FROM traffic_violations tv
        JOIN top_corridors tc ON ROUND(tv.latitude::numeric, 2) = tc.corridor_lat
        WHERE tv.stop_date IS NOT NULL AND tv.stop_time IS NOT NULL
        GROUP BY corridor_lat, day_num, hour
        ORDER BY corridor_lat, count DESC
      `),
    ]);

    const avgStopsPerCorridor = overallStats[0]?.avg_stops_per_corridor || 100;
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    // Process corridor data
    const processedCorridors = corridorData.map(c => {
      const totalStops = Number(c.total_stops);
      const uniqueLocations = Number(c.unique_locations);

      // Estimate corridor length in degrees (rough)
      const corridorLength = c.lng_range_end - c.lng_range_start;
      // Convert to approximate miles (at ~39 degrees latitude, 1 degree lng ≈ 54 miles)
      const approxMiles = Math.max(1, Math.round(corridorLength * 54));
      const stopsPerMile = Math.round((totalStops / approxMiles) * 10) / 10;

      // Calculate risk multiplier vs average
      const riskMultiplier = Math.round((totalStops / avgStopsPerCorridor) * 10) / 10;

      // Determine risk level
      const riskLevel: 'critical' | 'high' | 'moderate' | 'low' =
        stopsPerMile > 15 ? 'critical' :
        stopsPerMile > 8 ? 'high' :
        stopsPerMile > 4 ? 'moderate' : 'low';

      // Get time windows for this corridor
      const corridorTimeData = timeWindowData.filter(t => t.corridor_lat === c.corridor_lat);

      // Find peak times (top 5 day/hour combos)
      const peakTimes = corridorTimeData
        .sort((a, b) => Number(b.count) - Number(a.count))
        .slice(0, 5)
        .map(t => ({
          day: dayNames[t.day_num],
          hour: t.hour,
          hourLabel: `${t.hour.toString().padStart(2, '0')}:00`,
          count: Number(t.count),
        }));

      // Identify hot windows (consecutive hours with high enforcement)
      const hotWindows: Array<{ day: string; hours: string; riskMultiplier: number }> = [];
      const safeWindows: Array<{ day: string; hours: string; riskMultiplier: number }> = [];

      // Group by day and find hot/safe windows
      dayNames.forEach((day, dayNum) => {
        const dayData = corridorTimeData
          .filter(t => t.day_num === dayNum)
          .sort((a, b) => a.hour - b.hour);

        if (dayData.length === 0) return;

        const dayTotal = dayData.reduce((sum, t) => sum + Number(t.count), 0);
        const avgPerHour = dayTotal / 24;

        // Find peak hours for this day
        const peakHours = dayData
          .filter(t => Number(t.count) > avgPerHour * 1.5)
          .map(t => t.hour);

        if (peakHours.length > 0) {
          const minHour = Math.min(...peakHours);
          const maxHour = Math.max(...peakHours);
          hotWindows.push({
            day,
            hours: `${minHour.toString().padStart(2, '0')}:00-${(maxHour + 1).toString().padStart(2, '0')}:00`,
            riskMultiplier: Math.round(
              (dayData.filter(t => peakHours.includes(t.hour))
                .reduce((sum, t) => sum + Number(t.count), 0) / peakHours.length / avgPerHour) * 10
            ) / 10,
          });
        }

        // Find safe hours for this day
        const safeHours = dayData
          .filter(t => Number(t.count) < avgPerHour * 0.5)
          .map(t => t.hour);

        if (safeHours.length >= 3) {
          safeWindows.push({
            day,
            hours: safeHours.length > 5 ? 'most hours' : safeHours.map(h => `${h}:00`).join(', '),
            riskMultiplier: 0.5,
          });
        }
      });

      // Generate insight
      let insight = `${totalStops} stops over ~${approxMiles} miles (${stopsPerMile}/mile).`;
      if (hotWindows.length > 0) {
        insight += ` Avoid ${hotWindows[0].day} ${hotWindows[0].hours}.`;
      }
      if (c.dominant_method) {
        insight += ` Primarily ${c.dominant_method} detection.`;
      }

      return {
        id: `corridor_${c.corridor_lat}`,
        latitudeCenter: c.corridor_lat,
        bounds: {
          south: c.corridor_lat - 0.005,
          north: c.corridor_lat + 0.005,
          west: c.lng_range_start,
          east: c.lng_range_end,
        },
        totalStops,
        uniqueLocations,
        approxMiles,
        stopsPerMile,
        riskMultiplier,
        riskLevel,
        avgSpeedOver: c.avg_speed_over || 0,
        dominantMethod: c.dominant_method || 'unknown',
        peakTimes: peakTimes.slice(0, 3),
        hotWindows: hotWindows.slice(0, 3),
        safeWindows: safeWindows.slice(0, 3),
        insight,
      };
    });

    // Sort by stops per mile (enforcement density)
    processedCorridors.sort((a, b) => b.stopsPerMile - a.stopsPerMile);

    // Summary stats
    const criticalCorridors = processedCorridors.filter(c => c.riskLevel === 'critical');
    const highRiskCorridors = processedCorridors.filter(c => c.riskLevel === 'high');

    return NextResponse.json({
      success: true,
      data: {
        corridors: processedCorridors,
        summary: {
          totalCorridors: processedCorridors.length,
          criticalCount: criticalCorridors.length,
          highRiskCount: highRiskCorridors.length,
          insight: criticalCorridors.length > 0
            ? `${criticalCorridors.length} critical corridors with 15+ stops/mile. Top: ${criticalCorridors[0]?.stopsPerMile}/mile.`
            : highRiskCorridors.length > 0
            ? `${highRiskCorridors.length} high-risk corridors with 8+ stops/mile.`
            : 'No critical enforcement corridors in this area.',
        },
        riskLevelGuide: {
          critical: { stopsPerMile: '15+', description: 'Extremely heavy enforcement - avoid if possible' },
          high: { stopsPerMile: '8-15', description: 'Heavy enforcement - drive carefully' },
          moderate: { stopsPerMile: '4-8', description: 'Normal enforcement levels' },
          low: { stopsPerMile: '<4', description: 'Light enforcement' },
        },
      },
      meta: {
        bounds: boundsStr || 'all',
        limit,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error fetching route risk:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch route risk data' },
      { status: 500 }
    );
  }
}
