/**
 * Mapbox Routing Service
 * Provides road-snapped routing using Mapbox Directions and Map Matching APIs
 */

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

export interface DirectionLeg {
  distance: number; // meters
  duration: number; // seconds
  summary: string;
  steps: DirectionStep[];
}

export interface DirectionStep {
  distance: number;
  duration: number;
  geometry: { coordinates: [number, number][] };
  maneuver: {
    type: string;
    instruction: string;
    bearing_after: number;
    bearing_before: number;
    location: [number, number];
  };
  name: string;
}

export interface DirectionsResponse {
  geometry: { coordinates: [number, number][] };
  distance: number; // meters
  duration: number; // seconds
  legs: DirectionLeg[];
}

export interface MapMatchingResponse {
  matchedCoordinates: [number, number][];
  confidence: number;
  distance: number; // meters
  duration: number; // seconds
}

/**
 * Get road-snapped directions between waypoints using Mapbox Directions API
 * @param waypoints Array of [longitude, latitude] coordinates
 * @param profile Routing profile: 'driving' or 'driving-traffic'
 * @returns Route geometry, distance, duration, and turn-by-turn directions
 */
export async function getDirections(
  waypoints: [number, number][],
  profile: 'driving' | 'driving-traffic' = 'driving'
): Promise<DirectionsResponse | null> {
  if (!MAPBOX_TOKEN) {
    console.error('Mapbox token not configured');
    return null;
  }

  if (waypoints.length < 2) {
    console.error('At least 2 waypoints required');
    return null;
  }

  // Format coordinates as "lng,lat;lng,lat;..."
  const coordinates = waypoints
    .map(([lng, lat]) => `${lng},${lat}`)
    .join(';');

  const url = new URL(
    `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coordinates}`
  );

  url.searchParams.set('access_token', MAPBOX_TOKEN);
  url.searchParams.set('geometries', 'geojson');
  url.searchParams.set('overview', 'full');
  url.searchParams.set('steps', 'true');
  url.searchParams.set('annotations', 'distance,duration');

  try {
    const response = await fetch(url.toString());

    if (!response.ok) {
      const error = await response.text();
      console.error('Directions API error:', error);
      return null;
    }

    const data = await response.json();

    if (!data.routes || data.routes.length === 0) {
      console.error('No routes found');
      return null;
    }

    const route = data.routes[0];

    return {
      geometry: route.geometry,
      distance: route.distance,
      duration: route.duration,
      legs: route.legs.map((leg: DirectionLeg) => ({
        distance: leg.distance,
        duration: leg.duration,
        summary: leg.summary,
        steps: leg.steps,
      })),
    };
  } catch (error) {
    console.error('Failed to fetch directions:', error);
    return null;
  }
}

/**
 * Snap GPS trace to road network using Mapbox Map Matching API
 * @param coordinates Array of [longitude, latitude] from GPS recording
 * @param timestamps Optional array of Unix timestamps (milliseconds)
 * @returns Snapped coordinates following actual road network
 */
export async function matchGPSToRoads(
  coordinates: [number, number][],
  timestamps?: number[]
): Promise<MapMatchingResponse | null> {
  if (!MAPBOX_TOKEN) {
    console.error('Mapbox token not configured');
    return null;
  }

  if (coordinates.length < 2) {
    console.error('At least 2 coordinates required');
    return null;
  }

  // Map Matching API has a limit of 100 coordinates per request
  // If we have more, we need to batch and stitch together
  const MAX_COORDS = 100;

  if (coordinates.length > MAX_COORDS) {
    return await batchMatchGPS(coordinates, timestamps);
  }

  const coordString = coordinates
    .map(([lng, lat]) => `${lng},${lat}`)
    .join(';');

  const url = new URL(
    `https://api.mapbox.com/matching/v5/mapbox/driving/${coordString}`
  );

  url.searchParams.set('access_token', MAPBOX_TOKEN);
  url.searchParams.set('geometries', 'geojson');
  url.searchParams.set('overview', 'full');
  url.searchParams.set('tidy', 'true');

  // Add timestamps if provided (improves matching accuracy)
  if (timestamps && timestamps.length === coordinates.length) {
    // Convert to Unix seconds
    const timestampsSeconds = timestamps.map(t => Math.floor(t / 1000));
    url.searchParams.set('timestamps', timestampsSeconds.join(';'));
  }

  try {
    const response = await fetch(url.toString());

    if (!response.ok) {
      const error = await response.text();
      console.error('Map Matching API error:', error);
      return null;
    }

    const data = await response.json();

    if (!data.matchings || data.matchings.length === 0) {
      console.error('No matching found');
      return null;
    }

    const matching = data.matchings[0];

    return {
      matchedCoordinates: matching.geometry.coordinates,
      confidence: matching.confidence,
      distance: matching.distance,
      duration: matching.duration,
    };
  } catch (error) {
    console.error('Failed to match GPS:', error);
    return null;
  }
}

/**
 * Batch process GPS coordinates when exceeding API limits
 */
async function batchMatchGPS(
  coordinates: [number, number][],
  timestamps?: number[]
): Promise<MapMatchingResponse | null> {
  const BATCH_SIZE = 100;
  const OVERLAP = 5; // Overlap for stitching

  const batches: [number, number][][] = [];
  const timestampBatches: number[][] = [];

  for (let i = 0; i < coordinates.length; i += BATCH_SIZE - OVERLAP) {
    const end = Math.min(i + BATCH_SIZE, coordinates.length);
    batches.push(coordinates.slice(i, end));

    if (timestamps) {
      timestampBatches.push(timestamps.slice(i, end));
    }
  }

  let allCoordinates: [number, number][] = [];
  let totalDistance = 0;
  let totalDuration = 0;
  let minConfidence = 1;

  for (let i = 0; i < batches.length; i++) {
    const result = await matchGPSToRoads(
      batches[i],
      timestamps ? timestampBatches[i] : undefined
    );

    if (!result) {
      console.error(`Batch ${i + 1} failed`);
      continue;
    }

    // Skip overlapping points except for first batch
    const startIndex = i === 0 ? 0 : OVERLAP;
    const coords = result.matchedCoordinates.slice(startIndex);

    allCoordinates = allCoordinates.concat(coords);
    totalDistance += result.distance;
    totalDuration += result.duration;
    minConfidence = Math.min(minConfidence, result.confidence);
  }

  if (allCoordinates.length === 0) {
    return null;
  }

  return {
    matchedCoordinates: allCoordinates,
    confidence: minConfidence,
    distance: totalDistance,
    duration: totalDuration,
  };
}

/**
 * Convert meters to miles
 */
export function metersToMiles(meters: number): number {
  return meters * 0.000621371;
}

/**
 * Convert seconds to formatted duration string
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes} min`;
}

/**
 * Calculate simple straight-line distance between two points (Haversine)
 * Used for rough estimates before API calls
 */
export function haversineDistance(
  point1: [number, number],
  point2: [number, number]
): number {
  const [lng1, lat1] = point1;
  const [lng2, lat2] = point2;

  const R = 3959; // Earth radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Simplify a path by removing points that are too close together
 * Useful for reducing GPS noise before sending to API
 */
export function simplifyPath(
  coordinates: [number, number][],
  minDistanceMeters: number = 10
): [number, number][] {
  if (coordinates.length < 2) return coordinates;

  const result: [number, number][] = [coordinates[0]];

  for (let i = 1; i < coordinates.length; i++) {
    const lastPoint = result[result.length - 1];
    const currentPoint = coordinates[i];

    const distance = haversineDistance(lastPoint, currentPoint) * 1609.34; // miles to meters

    if (distance >= minDistanceMeters) {
      result.push(currentPoint);
    }
  }

  // Always include the last point
  const last = coordinates[coordinates.length - 1];
  if (result[result.length - 1] !== last) {
    result.push(last);
  }

  return result;
}
