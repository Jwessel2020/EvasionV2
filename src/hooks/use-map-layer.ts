'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useMap } from '@/components/map/MapProvider';
import type mapboxgl from 'mapbox-gl';

export interface UseMapLayerOptions {
  sourceId: string;
  layerIds: string[];
  visible?: boolean;
  debounceMs?: number;
}

export interface UseMapLayerReturn {
  map: mapboxgl.Map | null;
  isLoaded: boolean;
  layersAdded: boolean;
  setLayersAdded: (value: boolean) => void;
  fetchWithAbort: <T>(
    fetchFn: (signal: AbortSignal) => Promise<T>
  ) => Promise<T | null>;
  updateVisibility: (visible: boolean) => void;
  setupEventHandlers: (handlers: MapEventHandler[]) => () => void;
  debouncedFetch: (fetchFn: () => Promise<void>) => void;
}

export interface MapEventHandler {
  event: string;
  layerId?: string;
  handler: (e: mapboxgl.MapLayerMouseEvent | mapboxgl.MapMouseEvent) => void;
}

/**
 * Shared hook for map layer management
 * Provides common functionality for abort controllers, visibility, event handling, and debouncing
 */
export function useMapLayer({
  sourceId,
  layerIds,
  visible = true,
  debounceMs = 300,
}: UseMapLayerOptions): UseMapLayerReturn {
  const { map, isLoaded } = useMap();
  const [layersAdded, setLayersAdded] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  // Keep map ref updated
  useEffect(() => {
    mapRef.current = map;
  }, [map]);

  // Fetch with automatic abort controller management
  const fetchWithAbort = useCallback(async <T,>(
    fetchFn: (signal: AbortSignal) => Promise<T>
  ): Promise<T | null> => {
    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      return await fetchFn(abortControllerRef.current.signal);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return null;
      }
      throw error;
    }
  }, []);

  // Debounced fetch helper
  const debouncedFetch = useCallback((fetchFn: () => Promise<void>) => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    debounceTimeoutRef.current = setTimeout(() => {
      fetchFn();
    }, debounceMs);
  }, [debounceMs]);

  // Update visibility for all layers
  const updateVisibility = useCallback((isVisible: boolean) => {
    if (!map || !layersAdded) return;

    try {
      const visibility = isVisible ? 'visible' : 'none';
      layerIds.forEach(layerId => {
        if (map.getLayer(layerId)) {
          map.setLayoutProperty(layerId, 'visibility', visibility);
        }
      });
    } catch {
      // Layer may not exist yet
    }
  }, [map, layersAdded, layerIds]);

  // Setup event handlers with automatic cleanup
  const setupEventHandlers = useCallback((handlers: MapEventHandler[]) => {
    if (!map) return () => {};

    // Delay to ensure layers exist
    const timeoutId = setTimeout(() => {
      try {
        handlers.forEach(({ event, layerId, handler }) => {
          if (layerId) {
            map.on(event, layerId, handler as (e: mapboxgl.MapLayerMouseEvent) => void);
          } else {
            map.on(event, handler as (e: mapboxgl.MapMouseEvent) => void);
          }
        });
      } catch {
        // Ignore errors if layers don't exist
      }
    }, 100);

    // Return cleanup function
    return () => {
      clearTimeout(timeoutId);
      const currentMap = mapRef.current;
      if (!currentMap) return;

      try {
        handlers.forEach(({ event, layerId, handler }) => {
          if (layerId) {
            currentMap.off(event, layerId, handler as (e: mapboxgl.MapLayerMouseEvent) => void);
          } else {
            currentMap.off(event, handler as (e: mapboxgl.MapMouseEvent) => void);
          }
        });
      } catch {
        // Map may have been destroyed
      }
    };
  }, [map]);

  // Update visibility when prop changes
  useEffect(() => {
    updateVisibility(visible);
  }, [visible, updateVisibility]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  return {
    map,
    isLoaded,
    layersAdded,
    setLayersAdded,
    fetchWithAbort,
    updateVisibility,
    setupEventHandlers,
    debouncedFetch,
  };
}

/**
 * Helper to build URL params from filter object
 */
export function buildFilterParams(filters: Record<string, unknown>): URLSearchParams {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      if (typeof value === 'boolean') {
        if (value) params.set(key, 'true');
      } else {
        params.set(key, String(value));
      }
    }
  });

  return params;
}

/**
 * Helper to add bounds to params
 */
export function addBoundsToParams(
  params: URLSearchParams,
  map: mapboxgl.Map | null
): boolean {
  if (!map) return false;

  const bounds = map.getBounds();
  if (!bounds) return false;

  params.set('bounds', `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`);
  return true;
}

/**
 * Helper cursor handlers for map layers
 */
export function createCursorHandlers(map: mapboxgl.Map) {
  return {
    handleMouseEnter: () => {
      map.getCanvas().style.cursor = 'pointer';
    },
    handleMouseLeave: () => {
      map.getCanvas().style.cursor = '';
    },
  };
}
