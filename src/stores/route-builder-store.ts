/**
 * Route Builder Store
 * State management for manual route creation with road-snapped routing
 */

import { create } from 'zustand';
import { getDirections, metersToMiles, type DirectionsResponse } from '@/lib/mapbox/routing';

export interface Waypoint {
  id: string;
  lng: number;
  lat: number;
  label?: string;
  address?: string;
}

export type RouteBuilderMode = 'idle' | 'drawing' | 'editing';

interface RouteBuilderState {
  // Mode
  mode: RouteBuilderMode;

  // Waypoints (user-placed markers)
  waypoints: Waypoint[];
  selectedWaypointIndex: number | null;

  // Computed route from Directions API
  routeGeometry: [number, number][] | null;
  routeDistance: number; // miles
  routeDuration: number; // seconds
  legs: DirectionsResponse['legs'] | null;

  // Loading states
  isCalculating: boolean;
  error: string | null;

  // Actions
  setMode: (mode: RouteBuilderMode) => void;
  addWaypoint: (lng: number, lat: number) => Promise<void>;
  removeWaypoint: (index: number) => Promise<void>;
  moveWaypoint: (index: number, lng: number, lat: number) => Promise<void>;
  reorderWaypoints: (fromIndex: number, toIndex: number) => Promise<void>;
  selectWaypoint: (index: number | null) => void;
  clearRoute: () => void;
  setWaypoints: (waypoints: Waypoint[]) => void;
  loadRoute: (waypoints: Waypoint[], geometry: [number, number][], distance: number, duration: number) => void;

  // Internal
  _recalculateRoute: () => Promise<void>;
}

// Generate unique ID for waypoints
const generateId = () => `wp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

export const useRouteBuilderStore = create<RouteBuilderState>((set, get) => ({
  // Initial state
  mode: 'idle',
  waypoints: [],
  selectedWaypointIndex: null,
  routeGeometry: null,
  routeDistance: 0,
  routeDuration: 0,
  legs: null,
  isCalculating: false,
  error: null,

  // Set mode
  setMode: (mode) => set({ mode }),

  // Add waypoint and recalculate route
  addWaypoint: async (lng, lat) => {
    const { waypoints } = get();

    const newWaypoint: Waypoint = {
      id: generateId(),
      lng,
      lat,
    };

    set({ waypoints: [...waypoints, newWaypoint] });

    // Recalculate route if we have 2+ waypoints
    if (waypoints.length >= 1) {
      await get()._recalculateRoute();
    }
  },

  // Remove waypoint and recalculate route
  removeWaypoint: async (index) => {
    const { waypoints, selectedWaypointIndex } = get();

    if (index < 0 || index >= waypoints.length) return;

    const newWaypoints = waypoints.filter((_, i) => i !== index);

    // Adjust selected index if needed
    let newSelectedIndex = selectedWaypointIndex;
    if (selectedWaypointIndex !== null) {
      if (selectedWaypointIndex === index) {
        newSelectedIndex = null;
      } else if (selectedWaypointIndex > index) {
        newSelectedIndex = selectedWaypointIndex - 1;
      }
    }

    set({
      waypoints: newWaypoints,
      selectedWaypointIndex: newSelectedIndex,
    });

    // Recalculate or clear route
    if (newWaypoints.length >= 2) {
      await get()._recalculateRoute();
    } else {
      set({
        routeGeometry: null,
        routeDistance: 0,
        routeDuration: 0,
        legs: null,
      });
    }
  },

  // Move waypoint (drag) and recalculate route
  moveWaypoint: async (index, lng, lat) => {
    const { waypoints } = get();

    if (index < 0 || index >= waypoints.length) return;

    const newWaypoints = waypoints.map((wp, i) =>
      i === index ? { ...wp, lng, lat } : wp
    );

    set({ waypoints: newWaypoints });

    // Recalculate route
    if (newWaypoints.length >= 2) {
      await get()._recalculateRoute();
    }
  },

  // Reorder waypoints (drag and drop in list)
  reorderWaypoints: async (fromIndex, toIndex) => {
    const { waypoints } = get();

    if (fromIndex === toIndex) return;
    if (fromIndex < 0 || fromIndex >= waypoints.length) return;
    if (toIndex < 0 || toIndex >= waypoints.length) return;

    const newWaypoints = [...waypoints];
    const [removed] = newWaypoints.splice(fromIndex, 1);
    newWaypoints.splice(toIndex, 0, removed);

    set({ waypoints: newWaypoints });

    // Recalculate route
    if (newWaypoints.length >= 2) {
      await get()._recalculateRoute();
    }
  },

  // Select waypoint
  selectWaypoint: (index) => set({ selectedWaypointIndex: index }),

  // Clear all waypoints and route
  clearRoute: () =>
    set({
      waypoints: [],
      selectedWaypointIndex: null,
      routeGeometry: null,
      routeDistance: 0,
      routeDuration: 0,
      legs: null,
      error: null,
    }),

  // Set waypoints directly (for loading saved routes)
  setWaypoints: (waypoints) => set({ waypoints }),

  // Load an existing route
  loadRoute: (waypoints, geometry, distance, duration) =>
    set({
      waypoints,
      routeGeometry: geometry,
      routeDistance: distance,
      routeDuration: duration,
      mode: 'editing',
    }),

  // Internal: Recalculate route using Directions API
  _recalculateRoute: async () => {
    const { waypoints } = get();

    if (waypoints.length < 2) {
      set({
        routeGeometry: null,
        routeDistance: 0,
        routeDuration: 0,
        legs: null,
      });
      return;
    }

    set({ isCalculating: true, error: null });

    try {
      // Convert waypoints to coordinate array
      const coordinates: [number, number][] = waypoints.map((wp) => [wp.lng, wp.lat]);

      const result = await getDirections(coordinates);

      if (!result) {
        set({
          error: 'Failed to calculate route. Please try again.',
          isCalculating: false,
        });
        return;
      }

      set({
        routeGeometry: result.geometry.coordinates,
        routeDistance: metersToMiles(result.distance),
        routeDuration: result.duration,
        legs: result.legs,
        error: null,
        isCalculating: false,
      });
    } catch (err) {
      console.error('Route calculation error:', err);
      set({
        error: 'Failed to calculate route',
        isCalculating: false,
      });
    }
  },
}));
