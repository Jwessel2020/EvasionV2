/**
 * Route Recorder Store
 * State management for GPS-based route recording with road snapping
 */

import { create } from 'zustand';
import { matchGPSToRoads, metersToMiles, simplifyPath } from '@/lib/mapbox/routing';

export interface GPSPoint {
  lng: number;
  lat: number;
  timestamp: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
}

export type RecordingState = 'idle' | 'recording' | 'paused' | 'processing' | 'preview';

interface RouteRecorderState {
  // Recording state
  state: RecordingState;

  // Raw GPS data
  rawPoints: GPSPoint[];

  // Matched route (after Map Matching API)
  matchedRoute: [number, number][] | null;

  // Stats
  distance: number; // miles
  duration: number; // seconds
  startTime: Date | null;
  pausedDuration: number; // seconds spent paused

  // Current position
  currentPosition: GPSPoint | null;

  // Processing
  isProcessing: boolean;
  matchConfidence: number | null;
  error: string | null;

  // Actions
  startRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
  stopRecording: () => Promise<void>;
  addPoint: (point: GPSPoint) => void;
  processRoute: () => Promise<void>;
  discardRoute: () => void;
  acceptRoute: () => { coordinates: [number, number][]; distance: number; duration: number } | null;
}

export const useRouteRecorderStore = create<RouteRecorderState>((set, get) => ({
  // Initial state
  state: 'idle',
  rawPoints: [],
  matchedRoute: null,
  distance: 0,
  duration: 0,
  startTime: null,
  pausedDuration: 0,
  currentPosition: null,
  isProcessing: false,
  matchConfidence: null,
  error: null,

  // Start GPS recording
  startRecording: () => {
    set({
      state: 'recording',
      rawPoints: [],
      matchedRoute: null,
      distance: 0,
      duration: 0,
      startTime: new Date(),
      pausedDuration: 0,
      currentPosition: null,
      matchConfidence: null,
      error: null,
    });
  },

  // Pause recording
  pauseRecording: () => {
    const { state } = get();
    if (state !== 'recording') return;

    set({ state: 'paused' });
  },

  // Resume recording
  resumeRecording: () => {
    const { state } = get();
    if (state !== 'paused') return;

    set({ state: 'recording' });
  },

  // Stop recording and trigger processing
  stopRecording: async () => {
    const { state, rawPoints } = get();

    if (state !== 'recording' && state !== 'paused') return;

    if (rawPoints.length < 2) {
      set({
        error: 'Not enough GPS points recorded. Please record a longer route.',
        state: 'idle',
      });
      return;
    }

    set({ state: 'processing' });
    await get().processRoute();
  },

  // Add GPS point during recording
  addPoint: (point) => {
    const { state, rawPoints } = get();

    if (state !== 'recording') return;

    // Update current position
    set({ currentPosition: point });

    // Calculate simple running distance
    let newDistance = get().distance;
    if (rawPoints.length > 0) {
      const lastPoint = rawPoints[rawPoints.length - 1];
      const segmentDistance = haversineDistance(
        [lastPoint.lng, lastPoint.lat],
        [point.lng, point.lat]
      );
      newDistance += segmentDistance;
    }

    // Calculate duration
    const startTime = get().startTime;
    const pausedDuration = get().pausedDuration;
    const now = new Date();
    const totalSeconds = startTime
      ? Math.floor((now.getTime() - startTime.getTime()) / 1000) - pausedDuration
      : 0;

    set({
      rawPoints: [...rawPoints, point],
      distance: newDistance,
      duration: totalSeconds,
    });
  },

  // Process recorded route through Map Matching API
  processRoute: async () => {
    const { rawPoints } = get();

    if (rawPoints.length < 2) {
      set({
        error: 'Not enough points to create a route',
        state: 'idle',
      });
      return;
    }

    set({ isProcessing: true, error: null });

    try {
      // Convert to coordinate array
      const coordinates: [number, number][] = rawPoints.map((p) => [p.lng, p.lat]);

      // Simplify path to reduce noise (min 10m between points)
      const simplified = simplifyPath(coordinates, 10);

      // Get timestamps
      const timestamps = rawPoints.map((p) => p.timestamp);

      // Match to roads
      const result = await matchGPSToRoads(simplified, timestamps);

      if (!result) {
        set({
          error: 'Failed to match route to roads. The recording may be too short or in an area without road data.',
          isProcessing: false,
          state: 'idle',
        });
        return;
      }

      set({
        matchedRoute: result.matchedCoordinates,
        distance: metersToMiles(result.distance),
        duration: result.duration,
        matchConfidence: result.confidence,
        isProcessing: false,
        state: 'preview',
      });
    } catch (err) {
      console.error('Route processing error:', err);
      set({
        error: 'Failed to process route',
        isProcessing: false,
        state: 'idle',
      });
    }
  },

  // Discard the recorded route
  discardRoute: () => {
    set({
      state: 'idle',
      rawPoints: [],
      matchedRoute: null,
      distance: 0,
      duration: 0,
      startTime: null,
      pausedDuration: 0,
      currentPosition: null,
      matchConfidence: null,
      error: null,
    });
  },

  // Accept the matched route and return data for saving
  acceptRoute: () => {
    const { matchedRoute, distance, duration, state } = get();

    if (state !== 'preview' || !matchedRoute) {
      return null;
    }

    // Reset state
    set({
      state: 'idle',
      rawPoints: [],
      matchedRoute: null,
      distance: 0,
      duration: 0,
      startTime: null,
      pausedDuration: 0,
      currentPosition: null,
      matchConfidence: null,
    });

    return {
      coordinates: matchedRoute,
      distance,
      duration,
    };
  },
}));

// Haversine distance calculation (miles)
function haversineDistance(
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
