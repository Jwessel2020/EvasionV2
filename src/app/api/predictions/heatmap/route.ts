import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * GET /api/predictions/heatmap
 * Returns ML-based risk predictions for map heatmap visualization
 *
 * Query params:
 * - bounds: "minLng,minLat,maxLng,maxLat" (required)
 * - hour: Hour of day 0-23 (optional, defaults to current)
 * - day: Day of week 0-6 (optional, defaults to current)
 * - limit: Maximum number of points (optional, defaults to 5000)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse bounds
    const boundsStr = searchParams.get('bounds');
    if (!boundsStr) {
      return NextResponse.json(
        { success: false, error: 'bounds parameter is required' },
        { status: 400 }
      );
    }

    const bounds = boundsStr.split(',').map(Number);
    if (bounds.length !== 4 || bounds.some(isNaN)) {
      return NextResponse.json(
        { success: false, error: 'bounds must be "minLng,minLat,maxLng,maxLat"' },
        { status: 400 }
      );
    }

    const [minLng, minLat, maxLng, maxLat] = bounds;

    // Optional parameters
    const now = new Date();
    const hour = searchParams.get('hour')
      ? parseInt(searchParams.get('hour')!)
      : now.getHours();
    const day = searchParams.get('day')
      ? parseInt(searchParams.get('day')!)
      : now.getDay();
    const limit = Math.min(
      parseInt(searchParams.get('limit') || '5000'),
      10000
    );

    // Create time window string to match database format
    const timeWindow = `hour_${hour}_day_${day}`;

    // Query predictions within bounds
    const predictions = await prisma.$queryRaw<Array<{
      id: string;
      latitude: number;
      longitude: number;
      probability: number;
      time_window: string;
      factors: unknown;
    }>>`
      SELECT id, latitude, longitude, probability, time_window, factors
      FROM police_predictions
      WHERE time_window = ${timeWindow}
        AND latitude >= ${minLat}
        AND latitude <= ${maxLat}
        AND longitude >= ${minLng}
        AND longitude <= ${maxLng}
        AND valid_until > NOW()
      ORDER BY probability DESC
      LIMIT ${limit}
    `;

    // Determine risk level
    const getRiskLevel = (prob: number): string => {
      if (prob >= 0.7) return 'very_high';
      if (prob >= 0.4) return 'high';
      if (prob >= 0.2) return 'medium';
      return 'low';
    };

    // Format as GeoJSON for Mapbox
    const features = predictions.map(p => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [p.longitude, p.latitude]
      },
      properties: {
        id: p.id,
        probability: Math.round(p.probability * 1000) / 1000,
        riskLevel: getRiskLevel(p.probability),
        // Weight for heatmap (0-1 scale, but we amplify high values)
        weight: Math.pow(p.probability, 0.7), // Slightly emphasize higher probs
        // Extract key factors for tooltips
        isRushHour: (p.factors as Record<string, unknown>)?.is_rush_hour ?? false,
        isWeekend: (p.factors as Record<string, unknown>)?.is_weekend ?? false,
        gridStopCount: (p.factors as Record<string, unknown>)?.grid_stop_count ?? 0
      }
    }));

    // Calculate statistics for the response
    const probabilities = predictions.map(p => p.probability);
    const stats = {
      count: predictions.length,
      min: probabilities.length > 0 ? Math.min(...probabilities) : 0,
      max: probabilities.length > 0 ? Math.max(...probabilities) : 0,
      mean: probabilities.length > 0
        ? probabilities.reduce((a, b) => a + b, 0) / probabilities.length
        : 0,
      highRiskCount: predictions.filter(p => p.probability >= 0.4).length,
      veryHighRiskCount: predictions.filter(p => p.probability >= 0.7).length
    };

    // Get model version from first prediction
    const modelVersion = predictions.length > 0
      ? (predictions[0].factors as Record<string, unknown>)?.model_version ?? 'unknown'
      : 'none';

    return NextResponse.json({
      success: true,
      data: {
        type: 'FeatureCollection',
        features
      },
      meta: {
        count: predictions.length,
        hour,
        day,
        dayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day],
        hourLabel: `${hour.toString().padStart(2, '0')}:00`,
        timeWindow,
        modelVersion,
        stats,
        bounds: { minLng, minLat, maxLng, maxLat }
      }
    });
  } catch (error) {
    // Handle missing table gracefully
    const errorMessage = error instanceof Error ? error.message : '';
    if (errorMessage.includes('does not exist') || errorMessage.includes('relation')) {
      return NextResponse.json({
        success: true,
        data: {
          type: 'FeatureCollection',
          features: []
        },
        meta: {
          count: 0,
          message: 'No predictions available. Run ml:train to generate predictions.'
        }
      });
    }

    console.error('Error fetching prediction heatmap:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch predictions' },
      { status: 500 }
    );
  }
}
