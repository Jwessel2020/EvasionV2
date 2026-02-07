import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Note: Using pre-computed signatures only for performance
// Database fallback removed to avoid Prisma bundling issues

/**
 * GET /api/insights/ml/location/[gridId]
 * Returns ML-learned patterns for a specific location
 *
 * Provides:
 * - Temporal signature (hour/day distributions, peak times)
 * - Detection profile (method distribution, strictness)
 * - SHAP explanation (top factors driving risk)
 * - Statistical significance
 */

interface LocationSignature {
  grid_id: string;
  lat: number;
  lng: number;
  total_stops: number;
  hour_distribution: number[];
  day_distribution: number[];
  peak_hours: number[];
  peak_days: number[];
  hour_concentration: number;
  day_concentration: number;
  weekday_ratio: number;
  primary_method: string;
  method_distribution: Record<string, number>;
  avg_speed_over: number;
  min_speed_over: number;
  strictness_level: string;
  hour_chi2: number;
  hour_pvalue: number;
  day_chi2: number;
  day_pvalue: number;
  is_significant: boolean;
  insight: string;
}

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function loadLocationSignatures(): Record<string, LocationSignature> | null {
  try {
    const sigPath = path.join(process.cwd(), 'ml', 'models', 'location_signatures_v2.0.0.json');
    if (fs.existsSync(sigPath)) {
      const data = fs.readFileSync(sigPath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading signatures:', error);
  }
  return null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ gridId: string }> }
) {
  try {
    const { gridId } = await params;

    // Parse grid ID (format: "lat_lng" e.g., "39.046_-77.120")
    const parts = gridId.split('_');
    if (parts.length !== 2) {
      return NextResponse.json(
        { success: false, error: 'Invalid grid ID format. Expected: lat_lng' },
        { status: 400 }
      );
    }

    const lat = parseFloat(parts[0]);
    const lng = parseFloat(parts[1]);

    if (isNaN(lat) || isNaN(lng)) {
      return NextResponse.json(
        { success: false, error: 'Invalid coordinates in grid ID' },
        { status: 400 }
      );
    }

    // Load pre-computed signature (fast, no database needed)
    const signatures = loadLocationSignatures();

    if (!signatures) {
      return NextResponse.json(
        { success: false, error: 'Location signatures not available. Run ML training first.' },
        { status: 503 }
      );
    }

    const signature = signatures[gridId];

    if (!signature) {
      // Location not in pre-computed signatures (likely has < 10 stops)
      return NextResponse.json(
        { success: false, error: 'No ML data for this location. Minimum 10 stops required.' },
        { status: 404 }
      );
    }

    // Generate insight if not present
    if (!signature.insight) {
      const parts: string[] = [];

      if (signature.hour_concentration > 0.3) {
        const peakHourRange = `${signature.peak_hours[0]}:00-${(signature.peak_hours[0] + 1) % 24}:00`;
        const peakDayNames = signature.peak_days.slice(0, 2).map(d => DAY_NAMES[d]).join('/');
        parts.push(`${Math.round(signature.hour_concentration * 100)}% of stops occur around ${peakHourRange} on ${peakDayNames}`);
      }

      if (signature.primary_method !== 'unknown') {
        parts.push(`${signature.primary_method} detection zone`);
      }

      if (signature.strictness_level === 'strict') {
        parts.push(`Strict enforcement (avg ${signature.avg_speed_over.toFixed(0)} over)`);
      }

      signature.insight = parts.join('. ') + '.';
    }

    // Format response
    return NextResponse.json({
      success: true,
      data: {
        location: {
          gridId: signature.grid_id,
          lat: signature.lat,
          lng: signature.lng,
        },

        temporalSignature: {
          hourDistribution: signature.hour_distribution,
          dayDistribution: signature.day_distribution,
          peakHours: signature.peak_hours,
          peakDays: signature.peak_days.map(d => DAY_NAMES[d]),
          peakDayNumbers: signature.peak_days,
          hourConcentration: Math.round(signature.hour_concentration * 100) / 100,
          dayConcentration: Math.round(signature.day_concentration * 100) / 100,
          weekdayRatio: Math.round(signature.weekday_ratio * 100) / 100,
          insight: signature.hour_concentration > 0.3
            ? `${Math.round(signature.hour_concentration * 100)}% of enforcement occurs around peak hours`
            : 'Enforcement spread across hours',
        },

        detectionProfile: {
          primaryMethod: signature.primary_method,
          methodDistribution: signature.method_distribution,
          avgSpeedOver: Math.round(signature.avg_speed_over * 10) / 10,
          minSpeedOver: signature.min_speed_over,
          strictnessLevel: signature.strictness_level,
          insight: `${signature.primary_method} detection with ${signature.strictness_level} enforcement`,
        },

        statistics: {
          totalStops: signature.total_stops,
          hourChi2: signature.hour_chi2,
          hourPvalue: signature.hour_pvalue,
          dayChi2: signature.day_chi2,
          dayPvalue: signature.day_pvalue,
          isSignificant: signature.is_significant,
          confidenceLevel: signature.hour_pvalue < 0.01 ? 'high' :
            signature.hour_pvalue < 0.05 ? 'medium' : 'low',
        },

        generatedInsight: signature.insight,
      },
      meta: {
        gridId,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error fetching location ML data:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch location ML data' },
      { status: 500 }
    );
  }
}
