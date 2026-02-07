import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * GET /api/insights/hotspots
 * Returns recurring speed trap hotspots - locations with consistent enforcement
 *
 * Query params:
 * - bounds: "minLng,minLat,maxLng,maxLat" (optional, filters to viewport)
 * - limit: Maximum hotspots to return (default 50, max 200)
 * - minStops: Minimum stops to qualify as hotspot (default 10)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse optional bounds
    const boundsStr = searchParams.get('bounds');
    let boundsClause = '';
    let boundsParams: number[] = [];

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

    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
    const minStops = parseInt(searchParams.get('minStops') || '10');

    // Query for recurring hotspots
    // A hotspot must have: 10+ stops, on at least 3 different days
    const hotspots = await prisma.$queryRawUnsafe<Array<{
      lat: number;
      lng: number;
      total_stops: bigint;
      unique_days: bigint;
      avg_speed_over: number;
      dominant_method: string;
      first_stop: Date;
      last_stop: Date;
    }>>(`
      SELECT
        ROUND(latitude::numeric, 3) as lat,
        ROUND(longitude::numeric, 3) as lng,
        COUNT(*) as total_stops,
        COUNT(DISTINCT stop_date) as unique_days,
        ROUND(AVG(speed_over)::numeric, 1) as avg_speed_over,
        MODE() WITHIN GROUP (ORDER BY detection_method) as dominant_method,
        MIN(stop_date) as first_stop,
        MAX(stop_date) as last_stop
      FROM traffic_violations
      WHERE latitude IS NOT NULL
        AND longitude IS NOT NULL
        ${boundsClause}
      GROUP BY lat, lng
      HAVING COUNT(*) >= ${minStops}
        AND COUNT(DISTINCT stop_date) >= 3
      ORDER BY total_stops DESC
      LIMIT ${limit}
    `);

    // For top hotspots, get detailed time patterns
    const topHotspotIds = hotspots.slice(0, 20).map((h, i) => ({
      index: i,
      lat: h.lat,
      lng: h.lng,
    }));

    // Get peak times for each hotspot
    const hotspotDetails = await Promise.all(
      topHotspotIds.map(async (hotspot) => {
        // Get day/hour breakdown for this hotspot
        const timeBreakdown = await prisma.$queryRaw<Array<{
          day_num: number;
          hour: number;
          count: bigint;
        }>>`
          SELECT
            EXTRACT(DOW FROM stop_date)::int as day_num,
            EXTRACT(HOUR FROM stop_time)::int as hour,
            COUNT(*) as count
          FROM traffic_violations
          WHERE ROUND(latitude::numeric, 3) = ${hotspot.lat}
            AND ROUND(longitude::numeric, 3) = ${hotspot.lng}
          GROUP BY day_num, hour
          ORDER BY count DESC
          LIMIT 10
        `;

        return {
          lat: hotspot.lat,
          lng: hotspot.lng,
          peakTimes: timeBreakdown.map(t => ({
            day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][t.day_num],
            hour: t.hour,
            count: Number(t.count),
          })),
        };
      })
    );

    // Merge hotspot data with peak times
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    const processedHotspots = hotspots.map((h, index) => {
      const details = hotspotDetails.find(d => d.lat === h.lat && d.lng === h.lng);
      const totalStops = Number(h.total_stops);
      const uniqueDays = Number(h.unique_days);

      // Calculate frequency score (higher = more consistent enforcement)
      // Ratio of stops per day of activity
      const frequencyScore = Math.round((totalStops / uniqueDays) * 10) / 10;

      // Determine hotspot severity
      const severity: 'critical' | 'high' | 'moderate' =
        totalStops > 100 ? 'critical' :
        totalStops > 50 ? 'high' : 'moderate';

      // Generate actionable insight
      let insight = '';
      if (details?.peakTimes && details.peakTimes.length > 0) {
        const topTime = details.peakTimes[0];
        const topDays = [...new Set(details.peakTimes.slice(0, 3).map(t => t.day))];
        insight = `${totalStops} stops total. Most active: ${topDays.join(', ')} around ${topTime.hour}:00`;
      } else {
        insight = `${totalStops} stops over ${uniqueDays} days`;
      }

      return {
        id: `hotspot_${index}`,
        lat: h.lat,
        lng: h.lng,
        totalStops,
        uniqueDays,
        frequencyScore,
        avgSpeedOver: h.avg_speed_over || 0,
        dominantMethod: h.dominant_method || 'unknown',
        severity,
        peakTimes: details?.peakTimes || [],
        dateRange: {
          first: h.first_stop,
          last: h.last_stop,
        },
        insight,
      };
    });

    // Calculate summary stats
    const totalHotspots = processedHotspots.length;
    const criticalCount = processedHotspots.filter(h => h.severity === 'critical').length;
    const highCount = processedHotspots.filter(h => h.severity === 'high').length;
    const totalStopsInHotspots = processedHotspots.reduce((sum, h) => sum + h.totalStops, 0);

    // Find the most common detection method across hotspots
    const methodCounts: Record<string, number> = {};
    processedHotspots.forEach(h => {
      methodCounts[h.dominantMethod] = (methodCounts[h.dominantMethod] || 0) + h.totalStops;
    });
    const dominantMethodOverall = Object.entries(methodCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown';

    return NextResponse.json({
      success: true,
      data: {
        hotspots: processedHotspots,
        summary: {
          totalHotspots,
          criticalCount,
          highCount,
          moderateCount: totalHotspots - criticalCount - highCount,
          totalStopsInHotspots,
          dominantMethod: dominantMethodOverall,
          insight: `Found ${totalHotspots} recurring enforcement locations. ${criticalCount} critical, ${highCount} high-risk.`,
        },
      },
      meta: {
        bounds: boundsStr || 'all',
        minStopsThreshold: minStops,
        limit,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error fetching hotspots:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch hotspots' },
      { status: 500 }
    );
  }
}
