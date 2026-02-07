import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * GET /api/predictions/risk
 * Returns ML-based risk prediction for a specific location and time
 *
 * Query params:
 * - lat: Latitude (required)
 * - lng: Longitude (required)
 * - hour: Hour of day 0-23 (optional, defaults to current)
 * - day: Day of week 0-6 (optional, defaults to current)
 * - radius: Search radius in km (optional, defaults to 5)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Required parameters
    const lat = parseFloat(searchParams.get('lat') || '');
    const lng = parseFloat(searchParams.get('lng') || '');

    if (isNaN(lat) || isNaN(lng)) {
      return NextResponse.json(
        { success: false, error: 'lat and lng parameters are required' },
        { status: 400 }
      );
    }

    // Optional parameters
    const now = new Date();
    const hour = searchParams.get('hour')
      ? parseInt(searchParams.get('hour')!)
      : now.getHours();
    const day = searchParams.get('day')
      ? parseInt(searchParams.get('day')!)
      : now.getDay();
    const radiusKm = parseFloat(searchParams.get('radius') || '5');

    // Create time window string to match database format
    const timeWindow = `hour_${hour}_day_${day}`;

    // Grid parameters (must match training script)
    const GRID_SIZE = 0.001; // ~100 meters
    const gridLat = Math.round(lat / GRID_SIZE) * GRID_SIZE;
    const gridLng = Math.round(lng / GRID_SIZE) * GRID_SIZE;
    const gridCell = `${gridLat.toFixed(3)}_${gridLng.toFixed(3)}`;

    // Calculate bounding box for nearby predictions
    // 1 degree latitude ≈ 111 km
    // 1 degree longitude ≈ 111 km * cos(lat)
    const latDelta = radiusKm / 111;
    const lngDelta = radiusKm / (111 * Math.cos(lat * Math.PI / 180));

    // Query predictions within radius for the specified time window
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
        AND latitude >= ${gridLat - latDelta}
        AND latitude <= ${gridLat + latDelta}
        AND longitude >= ${gridLng - lngDelta}
        AND longitude <= ${gridLng + lngDelta}
        AND valid_until > NOW()
      ORDER BY probability DESC
      LIMIT 100
    `;

    // Find the prediction for the user's exact grid cell
    let userPrediction = predictions.find(
      p => Math.abs(p.latitude - gridLat) < 0.0005 && Math.abs(p.longitude - gridLng) < 0.0005
    );

    // Calculate distances and sort by proximity
    const nearbyWithDistance = predictions
      .map(p => {
        const dLat = (p.latitude - lat) * 111;
        const dLng = (p.longitude - lng) * 111 * Math.cos(lat * Math.PI / 180);
        const distance = Math.sqrt(dLat * dLat + dLng * dLng);
        return { ...p, distanceMiles: distance * 0.621371 };
      })
      .sort((a, b) => a.distanceMiles - b.distanceMiles);

    // If no exact prediction, use nearest
    if (!userPrediction && nearbyWithDistance.length > 0) {
      userPrediction = nearbyWithDistance[0];
    }

    // Determine risk level
    const getRiskLevel = (prob: number): string => {
      if (prob >= 0.7) return 'very_high';
      if (prob >= 0.4) return 'high';
      if (prob >= 0.2) return 'medium';
      return 'low';
    };

    // Parse factors from the prediction
    const parseFactors = (factors: unknown): Array<{ name: string; impact: string }> => {
      if (!factors || typeof factors !== 'object') return [];

      const f = factors as Record<string, unknown>;
      const result: Array<{ name: string; impact: string }> = [];

      if (f.is_rush_hour) {
        result.push({ name: 'rush_hour', impact: '+15%' });
      }
      if (f.is_weekend) {
        result.push({ name: 'weekend', impact: '-10%' });
      }
      if (f.is_night) {
        result.push({ name: 'night_time', impact: '+5%' });
      }
      if (typeof f.grid_stop_count === 'number' && f.grid_stop_count > 100) {
        result.push({ name: 'high_activity_area', impact: '+20%' });
      }
      if (typeof f.radar_pct === 'number' && f.radar_pct > 0.5) {
        result.push({ name: 'radar_zone', impact: '+10%' });
      }
      if (typeof f.laser_pct === 'number' && f.laser_pct > 0.3) {
        result.push({ name: 'laser_zone', impact: '+12%' });
      }

      return result;
    };

    // Build response
    const probability = userPrediction?.probability ?? 0;
    const factors = userPrediction ? parseFactors(userPrediction.factors) : [];

    // Get model version from factors
    const modelVersion = (userPrediction?.factors as Record<string, unknown>)?.model_version ?? 'unknown';

    return NextResponse.json({
      success: true,
      data: {
        location: {
          lat,
          lng,
          gridCell,
          gridLat,
          gridLng
        },
        time: {
          hour,
          day,
          timeWindow,
          dayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day],
          hourLabel: `${hour.toString().padStart(2, '0')}:00`
        },
        prediction: {
          probability: Math.round(probability * 1000) / 1000,
          riskLevel: getRiskLevel(probability),
          confidence: predictions.length > 0 ? 0.85 : 0.5
        },
        factors,
        nearby: nearbyWithDistance.slice(0, 20).map(p => ({
          lat: p.latitude,
          lng: p.longitude,
          probability: Math.round(p.probability * 1000) / 1000,
          riskLevel: getRiskLevel(p.probability),
          distanceMiles: Math.round(p.distanceMiles * 100) / 100
        }))
      },
      meta: {
        modelVersion,
        generatedAt: new Date().toISOString(),
        predictionsInArea: predictions.length,
        radiusKm
      }
    });
  } catch (error) {
    // Handle missing table gracefully
    const errorMessage = error instanceof Error ? error.message : '';
    if (errorMessage.includes('does not exist') || errorMessage.includes('relation')) {
      return NextResponse.json({
        success: true,
        data: {
          location: { lat: 0, lng: 0, gridCell: '0_0' },
          time: { hour: 0, day: 0, timeWindow: 'hour_0_day_0' },
          prediction: { probability: 0, riskLevel: 'low', confidence: 0 },
          factors: [],
          nearby: []
        },
        meta: {
          modelVersion: 'none',
          message: 'No predictions available. Run ml:train to generate predictions.'
        }
      });
    }

    console.error('Error fetching risk prediction:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch prediction' },
      { status: 500 }
    );
  }
}
