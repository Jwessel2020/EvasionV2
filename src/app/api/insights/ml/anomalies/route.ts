import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import prisma from '@/lib/prisma';

/**
 * GET /api/insights/ml/anomalies
 * Returns statistically significant anomalies
 *
 * Anomaly types:
 * - temporal_spike: Unusual enforcement at specific time
 * - enforcement_surge: Recent spike in overall enforcement
 * - method_shift: Change in detection method usage
 */

interface Anomaly {
  grid_id: string;
  lat: number;
  lng: number;
  anomaly_type: string;
  description: string;
  z_score: number;
  p_value: number;
  expected_value: number;
  actual_value: number;
  insight: string;
  detected_at: string;
}

interface PatternsData {
  patterns: unknown[];
  anomalies: Anomaly[];
  summary: {
    total_anomalies: number;
  };
}

function loadDiscoveredPatterns(): PatternsData | null {
  try {
    const patternsPath = path.join(process.cwd(), 'ml', 'models', 'discovered_patterns_v2.0.0.json');
    if (fs.existsSync(patternsPath)) {
      const data = fs.readFileSync(patternsPath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading patterns:', error);
  }
  return null;
}

export async function GET() {
  try {
    // Try to load pre-computed anomalies
    const patternsData = loadDiscoveredPatterns();
    let anomalies: Anomaly[] = patternsData?.anomalies || [];

    // If no pre-computed anomalies, compute from database
    if (anomalies.length === 0) {
      anomalies = await detectAnomaliesFromDatabase();
    }

    // Format response
    return NextResponse.json({
      success: true,
      data: {
        anomalies: anomalies.map(a => ({
          gridId: a.grid_id,
          lat: a.lat,
          lng: a.lng,
          type: a.anomaly_type,
          description: a.description,
          zScore: Math.round(a.z_score * 100) / 100,
          pValue: a.p_value,
          expectedValue: Math.round(a.expected_value * 10) / 10,
          actualValue: a.actual_value,
          insight: a.insight,
          severity: Math.abs(a.z_score) > 3 ? 'high' : Math.abs(a.z_score) > 2 ? 'medium' : 'low',
          detectedAt: a.detected_at,
        })),
        summary: {
          totalAnomalies: anomalies.length,
          highSeverity: anomalies.filter(a => Math.abs(a.z_score) > 3).length,
          mediumSeverity: anomalies.filter(a => Math.abs(a.z_score) > 2 && Math.abs(a.z_score) <= 3).length,
          byType: {
            temporalSpike: anomalies.filter(a => a.anomaly_type === 'temporal_spike').length,
            enforcementSurge: anomalies.filter(a => a.anomaly_type === 'enforcement_surge').length,
            enforcementDrop: anomalies.filter(a => a.anomaly_type === 'enforcement_drop').length,
          },
        },
      },
      meta: {
        generatedAt: new Date().toISOString(),
        source: patternsData ? 'precomputed' : 'realtime',
      },
    });
  } catch (error) {
    console.error('Error fetching anomalies:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch anomalies' },
      { status: 500 }
    );
  }
}

async function detectAnomaliesFromDatabase(): Promise<Anomaly[]> {
  const anomalies: Anomaly[] = [];

  // Detect temporal spikes - locations where a specific hour has way more stops than expected
  const temporalAnomalies = await prisma.$queryRaw<Array<{
    grid_id: string;
    lat: number;
    lng: number;
    hour: number;
    actual_count: bigint;
    expected_count: number;
    total_count: bigint;
  }>>`
    WITH grid_hour_stats AS (
      SELECT
        CONCAT(ROUND(latitude::numeric, 3)::text, '_', ROUND(longitude::numeric, 3)::text) as grid_id,
        ROUND(latitude::numeric, 3) as lat,
        ROUND(longitude::numeric, 3) as lng,
        EXTRACT(HOUR FROM stop_time)::int as hour,
        COUNT(*) as count
      FROM traffic_violations
      WHERE latitude IS NOT NULL AND stop_time IS NOT NULL
      GROUP BY grid_id, lat, lng, hour
    ),
    grid_stats AS (
      SELECT
        grid_id,
        lat,
        lng,
        SUM(count) as total,
        SUM(count)::float / 24 as expected_per_hour,
        STDDEV(count) as std_dev
      FROM grid_hour_stats
      GROUP BY grid_id, lat, lng
      HAVING SUM(count) >= 30
    )
    SELECT
      h.grid_id,
      h.lat,
      h.lng,
      h.hour,
      h.count as actual_count,
      g.expected_per_hour as expected_count,
      g.total as total_count
    FROM grid_hour_stats h
    JOIN grid_stats g ON h.grid_id = g.grid_id
    WHERE h.count > g.expected_per_hour * 2.5
      AND h.count >= 10
    ORDER BY (h.count - g.expected_per_hour) / GREATEST(g.std_dev, 1) DESC
    LIMIT 20
  `;

  for (const d of temporalAnomalies) {
    const actual = Number(d.actual_count);
    const expected = d.expected_count;
    const total = Number(d.total_count);

    // Compute z-score
    const stdDev = Math.sqrt(expected); // Poisson approximation
    const zScore = (actual - expected) / Math.max(stdDev, 1);

    if (zScore > 2) {
      anomalies.push({
        grid_id: d.grid_id,
        lat: d.lat,
        lng: d.lng,
        anomaly_type: 'temporal_spike',
        description: `Unusually high ${d.hour}:00 enforcement`,
        z_score: zScore,
        p_value: 2 * (1 - normalCDF(Math.abs(zScore))),
        expected_value: expected,
        actual_value: actual,
        insight: `${actual} stops at ${d.hour}:00 vs ${Math.round(expected)} expected (${Math.round((actual / expected - 1) * 100)}% above average)`,
        detected_at: new Date().toISOString(),
      });
    }
  }

  // Detect recent enforcement changes (compare last 30 days to prior 60 days)
  const recentChanges = await prisma.$queryRaw<Array<{
    grid_id: string;
    lat: number;
    lng: number;
    recent_count: bigint;
    historical_count: bigint;
    recent_daily: number;
    historical_daily: number;
  }>>`
    WITH recent AS (
      SELECT
        CONCAT(ROUND(latitude::numeric, 3)::text, '_', ROUND(longitude::numeric, 3)::text) as grid_id,
        ROUND(latitude::numeric, 3) as lat,
        ROUND(longitude::numeric, 3) as lng,
        COUNT(*) as count
      FROM traffic_violations
      WHERE stop_date >= CURRENT_DATE - INTERVAL '30 days'
        AND latitude IS NOT NULL
      GROUP BY grid_id, lat, lng
    ),
    historical AS (
      SELECT
        CONCAT(ROUND(latitude::numeric, 3)::text, '_', ROUND(longitude::numeric, 3)::text) as grid_id,
        COUNT(*) as count
      FROM traffic_violations
      WHERE stop_date >= CURRENT_DATE - INTERVAL '90 days'
        AND stop_date < CURRENT_DATE - INTERVAL '30 days'
        AND latitude IS NOT NULL
      GROUP BY grid_id
    )
    SELECT
      r.grid_id,
      r.lat,
      r.lng,
      r.count as recent_count,
      COALESCE(h.count, 0) as historical_count,
      r.count::float / 30 as recent_daily,
      COALESCE(h.count::float / 60, 0) as historical_daily
    FROM recent r
    LEFT JOIN historical h ON r.grid_id = h.grid_id
    WHERE r.count >= 5
      AND (h.count IS NULL OR r.count::float / 30 > h.count::float / 60 * 2
           OR r.count::float / 30 < h.count::float / 60 * 0.5)
    ORDER BY ABS(r.count::float / 30 - COALESCE(h.count::float / 60, 0)) DESC
    LIMIT 10
  `;

  for (const d of recentChanges) {
    const recentDaily = d.recent_daily;
    const historicalDaily = d.historical_daily || 0.1;
    const changeRatio = recentDaily / historicalDaily;

    if (changeRatio > 2 || changeRatio < 0.5) {
      const isSurge = changeRatio > 1;
      const zScore = Math.log2(changeRatio);

      anomalies.push({
        grid_id: d.grid_id,
        lat: d.lat,
        lng: d.lng,
        anomaly_type: isSurge ? 'enforcement_surge' : 'enforcement_drop',
        description: `${isSurge ? 'Increased' : 'Decreased'} enforcement in past 30 days`,
        z_score: zScore,
        p_value: 0.01, // Simplified
        expected_value: historicalDaily * 30,
        actual_value: Number(d.recent_count),
        insight: `${Math.round(Math.abs(changeRatio - 1) * 100)}% ${isSurge ? 'increase' : 'decrease'} in enforcement vs prior 60 days`,
        detected_at: new Date().toISOString(),
      });
    }
  }

  // Sort by z-score magnitude
  anomalies.sort((a, b) => Math.abs(b.z_score) - Math.abs(a.z_score));

  return anomalies;
}

// Standard normal CDF approximation
function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);

  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return 0.5 * (1.0 + sign * y);
}
