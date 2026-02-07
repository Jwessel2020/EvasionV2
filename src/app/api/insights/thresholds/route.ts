import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * GET /api/insights/thresholds
 * Returns speed-over threshold analysis - "How fast is too fast?"
 *
 * Provides:
 * - Overall speed-over distribution
 * - Threshold by detection method (radar vs laser vs vascar)
 * - Threshold by location (which areas are strict vs lenient)
 * - Percentile analysis (what speed-over level gets 90% of tickets)
 */
export async function GET() {
  try {
    // Run all threshold queries in parallel
    const [
      speedDistribution,
      methodBreakdown,
      percentileData,
      locationStrictness,
      speedLimitBreakdown,
    ] = await Promise.all([
      // Query 1: Speed-over distribution in buckets
      prisma.$queryRaw<Array<{
        bucket: string;
        min_speed: number;
        max_speed: number;
        count: bigint;
      }>>`
        SELECT
          CASE
            WHEN speed_over < 5 THEN '1-4'
            WHEN speed_over < 10 THEN '5-9'
            WHEN speed_over < 15 THEN '10-14'
            WHEN speed_over < 20 THEN '15-19'
            WHEN speed_over < 25 THEN '20-24'
            WHEN speed_over < 30 THEN '25-29'
            ELSE '30+'
          END as bucket,
          MIN(speed_over) as min_speed,
          MAX(speed_over) as max_speed,
          COUNT(*) as count
        FROM traffic_violations
        WHERE speed_over IS NOT NULL AND speed_over > 0
        GROUP BY bucket
        ORDER BY MIN(speed_over)
      `,

      // Query 2: Breakdown by detection method
      prisma.$queryRaw<Array<{
        method: string;
        count: bigint;
        avg_speed_over: number;
        min_speed_over: number;
        median_speed_over: number;
        p10_speed_over: number;
      }>>`
        SELECT
          detection_method as method,
          COUNT(*) as count,
          ROUND(AVG(speed_over)::numeric, 1) as avg_speed_over,
          MIN(speed_over) as min_speed_over,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY speed_over)::numeric as median_speed_over,
          PERCENTILE_CONT(0.1) WITHIN GROUP (ORDER BY speed_over)::numeric as p10_speed_over
        FROM traffic_violations
        WHERE speed_over IS NOT NULL
          AND speed_over > 0
          AND detection_method IS NOT NULL
        GROUP BY detection_method
        ORDER BY count DESC
      `,

      // Query 3: Overall percentiles
      prisma.$queryRaw<Array<{
        p10: number;
        p25: number;
        p50: number;
        p75: number;
        p90: number;
        avg: number;
      }>>`
        SELECT
          PERCENTILE_CONT(0.1) WITHIN GROUP (ORDER BY speed_over)::numeric as p10,
          PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY speed_over)::numeric as p25,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY speed_over)::numeric as p50,
          PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY speed_over)::numeric as p75,
          PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY speed_over)::numeric as p90,
          ROUND(AVG(speed_over)::numeric, 1) as avg
        FROM traffic_violations
        WHERE speed_over IS NOT NULL AND speed_over > 0
      `,

      // Query 4: Location strictness (avg speed-over by grid cell)
      prisma.$queryRaw<Array<{
        grid_id: string;
        lat: number;
        lng: number;
        count: bigint;
        avg_speed_over: number;
        min_speed_over: number;
      }>>`
        SELECT
          CONCAT(ROUND(latitude::numeric, 2)::text, '_', ROUND(longitude::numeric, 2)::text) as grid_id,
          ROUND(latitude::numeric, 2) as lat,
          ROUND(longitude::numeric, 2) as lng,
          COUNT(*) as count,
          ROUND(AVG(speed_over)::numeric, 1) as avg_speed_over,
          MIN(speed_over) as min_speed_over
        FROM traffic_violations
        WHERE speed_over IS NOT NULL
          AND speed_over > 0
          AND latitude IS NOT NULL
        GROUP BY grid_id, lat, lng
        HAVING COUNT(*) >= 20
        ORDER BY avg_speed_over ASC
        LIMIT 100
      `,

      // Query 5: Speed limit analysis
      prisma.$queryRaw<Array<{
        posted_limit: number;
        count: bigint;
        avg_speed_over: number;
        median_speed_over: number;
      }>>`
        SELECT
          posted_limit,
          COUNT(*) as count,
          ROUND(AVG(speed_over)::numeric, 1) as avg_speed_over,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY speed_over)::numeric as median_speed_over
        FROM traffic_violations
        WHERE posted_limit IS NOT NULL
          AND speed_over IS NOT NULL
          AND speed_over > 0
        GROUP BY posted_limit
        HAVING COUNT(*) >= 100
        ORDER BY posted_limit
      `,
    ]);

    // Process speed distribution
    const totalWithSpeed = speedDistribution.reduce((sum, d) => sum + Number(d.count), 0);
    let cumulative = 0;

    const distribution = speedDistribution.map(d => {
      const count = Number(d.count);
      cumulative += count;
      const pct = Math.round((count / totalWithSpeed) * 1000) / 10;
      const cumulativePct = Math.round((cumulative / totalWithSpeed) * 1000) / 10;

      return {
        bucket: d.bucket,
        count,
        percentage: pct,
        cumulativePercentage: cumulativePct,
      };
    });

    // Find the "typical" ticketing threshold (where 10% of tickets are below)
    const p10Threshold = percentileData[0]?.p10 || 10;
    const underTenPct = distribution
      .filter(d => d.bucket === '1-4' || d.bucket === '5-9')
      .reduce((sum, d) => sum + d.percentage, 0);

    // Process method breakdown
    const methodAnalysis = methodBreakdown.map(m => {
      const count = Number(m.count);
      const strictness: 'strict' | 'moderate' | 'lenient' =
        m.avg_speed_over < 12 ? 'strict' :
        m.avg_speed_over < 15 ? 'moderate' : 'lenient';

      return {
        method: m.method,
        count,
        avgSpeedOver: m.avg_speed_over,
        medianSpeedOver: Math.round(m.median_speed_over * 10) / 10,
        minTypical: Math.round(m.p10_speed_over), // 10th percentile = "minimum typical"
        strictness,
      };
    }).filter(m => m.method); // Filter out nulls

    // Process location strictness
    const locationAnalysis = locationStrictness.map(loc => {
      const strictness: 'strict' | 'moderate' | 'lenient' =
        loc.avg_speed_over < 12 ? 'strict' :
        loc.avg_speed_over < 15 ? 'moderate' : 'lenient';

      return {
        gridId: loc.grid_id,
        lat: loc.lat,
        lng: loc.lng,
        ticketCount: Number(loc.count),
        avgSpeedOver: loc.avg_speed_over,
        minSpeedOver: loc.min_speed_over,
        strictness,
      };
    });

    // Separate strict vs lenient areas
    const strictAreas = locationAnalysis.filter(l => l.strictness === 'strict').slice(0, 10);
    const lenientAreas = locationAnalysis.filter(l => l.strictness === 'lenient')
      .sort((a, b) => b.avgSpeedOver - a.avgSpeedOver).slice(0, 10);

    // Process speed limit analysis
    const speedLimitAnalysis = speedLimitBreakdown.map(sl => ({
      postedLimit: sl.posted_limit,
      ticketCount: Number(sl.count),
      avgSpeedOver: sl.avg_speed_over,
      medianSpeedOver: Math.round(sl.median_speed_over * 10) / 10,
    }));

    // Generate key insights
    const avgOverall = percentileData[0]?.avg || 0;
    const medianOverall = percentileData[0]?.p50 || 0;

    return NextResponse.json({
      success: true,
      data: {
        overall: {
          insight: `Under ${Math.round(p10Threshold)} mph over is rarely ticketed (${Math.round(underTenPct)}% of tickets). Most tickets are ${Math.round(medianOverall)}+ over.`,
          totalSpeedViolations: totalWithSpeed,
          averageSpeedOver: avgOverall,
          medianSpeedOver: Math.round(medianOverall * 10) / 10,
          percentiles: {
            p10: Math.round(percentileData[0]?.p10 || 0),
            p25: Math.round(percentileData[0]?.p25 || 0),
            p50: Math.round(percentileData[0]?.p50 || 0),
            p75: Math.round(percentileData[0]?.p75 || 0),
            p90: Math.round(percentileData[0]?.p90 || 0),
          },
          distribution,
        },

        byMethod: {
          insight: methodAnalysis.length > 0
            ? `${methodAnalysis[0].method} has lowest avg (${methodAnalysis.sort((a, b) => a.avgSpeedOver - b.avgSpeedOver)[0]?.avgSpeedOver} over). Different methods have different thresholds.`
            : 'Detection method data not available',
          methods: methodAnalysis.sort((a, b) => b.count - a.count),
        },

        byLocation: {
          insight: strictAreas.length > 0
            ? `Some areas ticket at ${strictAreas[0].avgSpeedOver} over avg, while lenient areas average ${lenientAreas[0]?.avgSpeedOver || 'N/A'} over.`
            : 'Location data not available',
          strictAreas,
          lenientAreas,
        },

        bySpeedLimit: {
          insight: speedLimitAnalysis.length > 0
            ? `Higher speed zones (${speedLimitAnalysis[speedLimitAnalysis.length - 1]?.postedLimit} mph) see avg ${speedLimitAnalysis[speedLimitAnalysis.length - 1]?.avgSpeedOver} over vs ${speedLimitAnalysis[0]?.avgSpeedOver} over in ${speedLimitAnalysis[0]?.postedLimit} mph zones.`
            : 'Speed limit data not available',
          data: speedLimitAnalysis,
        },

        recommendations: {
          generalThreshold: Math.round(p10Threshold),
          safeBuffer: Math.max(5, Math.round(p10Threshold) - 2),
          riskLevels: [
            { speedOver: '1-5', risk: 'very_low', description: 'Rarely ticketed' },
            { speedOver: '6-9', risk: 'low', description: 'Uncommon to be ticketed' },
            { speedOver: '10-14', risk: 'moderate', description: 'Within normal enforcement' },
            { speedOver: '15-19', risk: 'high', description: 'Frequently ticketed' },
            { speedOver: '20+', risk: 'very_high', description: 'Almost always ticketed' },
          ],
        },
      },
      meta: {
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error fetching thresholds:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch threshold data' },
      { status: 500 }
    );
  }
}
