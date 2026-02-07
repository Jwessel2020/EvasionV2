'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useMap } from './MapProvider';
import type mapboxgl from 'mapbox-gl';

interface PredictionLayerProps {
  visible?: boolean;
  hour?: number | null;
  day?: number | null;
}

const SOURCE_ID = 'predictions-source';
const HEATMAP_LAYER_ID = 'predictions-heatmap';
const CIRCLE_LAYER_ID = 'predictions-circles';

export function PredictionLayer({
  visible = true,
  hour = null,
  day = null,
}: PredictionLayerProps) {
  const { map, isLoaded } = useMap();
  const [layersAdded, setLayersAdded] = useState(false);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Fetch prediction heatmap data
  const fetchData = useCallback(async () => {
    if (!map) return;

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      const bounds = map.getBounds();
      if (!bounds) return;

      const params = new URLSearchParams();
      params.set('bounds', `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`);

      // Use provided hour/day or defaults will be applied by API
      if (hour !== null) {
        params.set('hour', hour.toString());
      }
      if (day !== null) {
        params.set('day', day.toString());
      }

      const res = await fetch(`/api/predictions/heatmap?${params}`, {
        signal: abortControllerRef.current.signal,
      });

      if (!res.ok) return;

      const json = await res.json();

      if (json.success && json.data?.features) {
        const source = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
        if (source) {
          source.setData(json.data);
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      console.warn('Error fetching predictions:', error);
    }
  }, [map, hour, day]);

  // Initialize layers
  useEffect(() => {
    if (!map || !isLoaded) return;

    mapRef.current = map;

    const initializeLayers = () => {
      try {
        // Add source
        if (!map.getSource(SOURCE_ID)) {
          map.addSource(SOURCE_ID, {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          });
        }

        // Add heatmap layer (shows at lower zoom levels)
        if (!map.getLayer(HEATMAP_LAYER_ID)) {
          map.addLayer({
            id: HEATMAP_LAYER_ID,
            type: 'heatmap',
            source: SOURCE_ID,
            maxzoom: 15,
            paint: {
              // Weight based on probability
              'heatmap-weight': [
                'interpolate',
                ['linear'],
                ['get', 'probability'],
                0, 0,
                0.2, 0.3,
                0.5, 0.6,
                0.7, 0.8,
                1, 1,
              ],
              // Intensity increases with zoom
              'heatmap-intensity': [
                'interpolate',
                ['linear'],
                ['zoom'],
                8, 0.5,
                12, 1,
                15, 1.5,
              ],
              // Color gradient: green -> yellow -> orange -> red
              'heatmap-color': [
                'interpolate',
                ['linear'],
                ['heatmap-density'],
                0, 'rgba(0,0,0,0)',
                0.1, 'rgba(34,197,94,0.4)',   // Green (low)
                0.3, 'rgba(250,204,21,0.6)',  // Yellow (moderate)
                0.5, 'rgba(249,115,22,0.7)',  // Orange (high)
                0.7, 'rgba(239,68,68,0.8)',   // Red (very high)
                1, 'rgba(185,28,28,0.9)',     // Dark red (extreme)
              ],
              // Radius increases with zoom
              'heatmap-radius': [
                'interpolate',
                ['linear'],
                ['zoom'],
                8, 15,
                12, 25,
                15, 40,
              ],
              // Fade out at high zoom where circles take over
              'heatmap-opacity': [
                'interpolate',
                ['linear'],
                ['zoom'],
                12, 0.8,
                14, 0.4,
                15, 0,
              ],
            },
          });
        }

        // Add circle layer for detailed view at high zoom
        if (!map.getLayer(CIRCLE_LAYER_ID)) {
          map.addLayer({
            id: CIRCLE_LAYER_ID,
            type: 'circle',
            source: SOURCE_ID,
            minzoom: 12,
            paint: {
              // Color based on risk level
              'circle-color': [
                'match',
                ['get', 'riskLevel'],
                'very_high', '#b91c1c',  // Dark red
                'high', '#f97316',       // Orange
                'medium', '#facc15',     // Yellow
                'low', '#22c55e',        // Green
                '#6b7280',               // Default gray
              ],
              // Size based on probability
              'circle-radius': [
                'interpolate',
                ['linear'],
                ['get', 'probability'],
                0, 4,
                0.5, 8,
                1, 12,
              ],
              // Opacity increases with zoom
              'circle-opacity': [
                'interpolate',
                ['linear'],
                ['zoom'],
                12, 0,
                14, 0.6,
                16, 0.8,
              ],
              'circle-stroke-width': 2,
              'circle-stroke-color': '#fff',
              'circle-stroke-opacity': [
                'interpolate',
                ['linear'],
                ['zoom'],
                12, 0,
                14, 0.5,
                16, 0.8,
              ],
            },
          });
        }

        setLayersAdded(true);
      } catch (error) {
        console.error('Error adding prediction layers:', error);
      }
    };

    initializeLayers();

    return () => {
      const currentMap = mapRef.current;
      if (!currentMap) return;

      try {
        if (currentMap.getLayer(CIRCLE_LAYER_ID)) currentMap.removeLayer(CIRCLE_LAYER_ID);
        if (currentMap.getLayer(HEATMAP_LAYER_ID)) currentMap.removeLayer(HEATMAP_LAYER_ID);
        if (currentMap.getSource(SOURCE_ID)) currentMap.removeSource(SOURCE_ID);
      } catch {
        // Map may have been destroyed
      }
      setLayersAdded(false);
    };
  }, [map, isLoaded]);

  // Fetch data on mount and when map moves
  useEffect(() => {
    if (!map || !layersAdded) return;

    // Initial fetch
    fetchData();

    // Fetch on move end (debounced)
    let timeout: NodeJS.Timeout;
    const handleMoveEnd = () => {
      clearTimeout(timeout);
      timeout = setTimeout(fetchData, 300);
    };

    map.on('moveend', handleMoveEnd);

    return () => {
      clearTimeout(timeout);
      map.off('moveend', handleMoveEnd);
    };
  }, [map, layersAdded, fetchData]);

  // Refetch when hour/day changes
  useEffect(() => {
    if (layersAdded) {
      fetchData();
    }
  }, [layersAdded, fetchData, hour, day]);

  // Update visibility
  useEffect(() => {
    if (!map || !layersAdded) return;

    try {
      const visibility = visible ? 'visible' : 'none';

      if (map.getLayer(HEATMAP_LAYER_ID)) {
        map.setLayoutProperty(HEATMAP_LAYER_ID, 'visibility', visibility);
      }
      if (map.getLayer(CIRCLE_LAYER_ID)) {
        map.setLayoutProperty(CIRCLE_LAYER_ID, 'visibility', visibility);
      }
    } catch {
      // Ignore errors during cleanup
    }
  }, [map, layersAdded, visible]);

  return null;
}
