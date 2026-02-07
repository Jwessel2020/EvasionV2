'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useMap } from './MapProvider';
import type mapboxgl from 'mapbox-gl';

interface Hotspot {
  id: string;
  lat: number;
  lng: number;
  totalStops: number;
  uniqueDays: number;
  frequencyScore: number;
  avgSpeedOver: number;
  dominantMethod: string;
  severity: 'critical' | 'high' | 'moderate';
  peakTimes: Array<{ day: string; hour: number; count: number }>;
  insight: string;
}

interface HotspotMarkersProps {
  visible?: boolean;
  minStops?: number;
  onHotspotClick?: (hotspot: Hotspot) => void;
}

const SOURCE_ID = 'hotspots-source';
const LAYER_ID = 'hotspots-layer';
const LABEL_LAYER_ID = 'hotspots-labels';

const SEVERITY_COLORS = {
  critical: '#ef4444',
  high: '#a855f7',
  moderate: '#facc15',
};

export function HotspotMarkers({
  visible = true,
  minStops = 10,
  onHotspotClick,
}: HotspotMarkersProps) {
  const { map, isLoaded } = useMap();
  const [layersAdded, setLayersAdded] = useState(false);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Fetch hotspot data
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
      params.set('minStops', minStops.toString());
      params.set('limit', '100');

      const res = await fetch(`/api/insights/hotspots?${params}`, {
        signal: abortControllerRef.current.signal,
      });

      if (!res.ok) return;

      const json = await res.json();

      if (json.success && json.data?.hotspots) {
        const features: GeoJSON.Feature[] = json.data.hotspots.map((h: Hotspot) => ({
          type: 'Feature' as const,
          geometry: {
            type: 'Point' as const,
            coordinates: [h.lng, h.lat],
          },
          properties: {
            id: h.id,
            totalStops: h.totalStops,
            uniqueDays: h.uniqueDays,
            frequencyScore: h.frequencyScore,
            avgSpeedOver: h.avgSpeedOver,
            dominantMethod: h.dominantMethod,
            severity: h.severity,
            insight: h.insight,
            // Size based on stops (10-30 pixels)
            size: Math.min(30, Math.max(10, 10 + (h.totalStops / 20))),
          },
        }));

        const source = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
        if (source) {
          source.setData({
            type: 'FeatureCollection',
            features,
          });
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      console.warn('Error fetching hotspots:', error);
    }
  }, [map, minStops]);

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

        // Add circle layer for hotspots
        if (!map.getLayer(LAYER_ID)) {
          map.addLayer({
            id: LAYER_ID,
            type: 'circle',
            source: SOURCE_ID,
            paint: {
              // Color based on severity
              'circle-color': [
                'match',
                ['get', 'severity'],
                'critical', SEVERITY_COLORS.critical,
                'high', SEVERITY_COLORS.high,
                'moderate', SEVERITY_COLORS.moderate,
                '#6b7280',
              ],
              // Size based on total stops
              'circle-radius': [
                'interpolate',
                ['linear'],
                ['get', 'totalStops'],
                10, 8,
                50, 14,
                100, 20,
                200, 26,
              ],
              'circle-opacity': 0.8,
              'circle-stroke-width': 3,
              'circle-stroke-color': '#fff',
              'circle-stroke-opacity': 0.9,
            },
          });
        }

        // Add label layer
        if (!map.getLayer(LABEL_LAYER_ID)) {
          map.addLayer({
            id: LABEL_LAYER_ID,
            type: 'symbol',
            source: SOURCE_ID,
            layout: {
              'text-field': ['get', 'totalStops'],
              'text-size': 10,
              'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
              'text-anchor': 'center',
              'text-allow-overlap': true,
            },
            paint: {
              'text-color': '#fff',
              'text-halo-color': '#000',
              'text-halo-width': 1,
            },
            minzoom: 10,
          });
        }

        setLayersAdded(true);
      } catch (error) {
        console.error('Error adding hotspot layers:', error);
      }
    };

    initializeLayers();

    // Handle click events
    const handleClick = (e: mapboxgl.MapLayerMouseEvent) => {
      if (e.features && e.features.length > 0 && onHotspotClick) {
        const props = e.features[0].properties;
        if (props) {
          onHotspotClick({
            id: props.id,
            lat: (e.features[0].geometry as GeoJSON.Point).coordinates[1],
            lng: (e.features[0].geometry as GeoJSON.Point).coordinates[0],
            totalStops: props.totalStops,
            uniqueDays: props.uniqueDays,
            frequencyScore: props.frequencyScore,
            avgSpeedOver: props.avgSpeedOver,
            dominantMethod: props.dominantMethod,
            severity: props.severity,
            insight: props.insight,
            peakTimes: [],
          });
        }
      }
    };

    // Cursor change on hover
    const handleMouseEnter = () => {
      map.getCanvas().style.cursor = 'pointer';
    };

    const handleMouseLeave = () => {
      map.getCanvas().style.cursor = '';
    };

    map.on('click', LAYER_ID, handleClick);
    map.on('mouseenter', LAYER_ID, handleMouseEnter);
    map.on('mouseleave', LAYER_ID, handleMouseLeave);

    return () => {
      const currentMap = mapRef.current;
      if (!currentMap) return;

      try {
        currentMap.off('click', LAYER_ID, handleClick);
        currentMap.off('mouseenter', LAYER_ID, handleMouseEnter);
        currentMap.off('mouseleave', LAYER_ID, handleMouseLeave);
        if (currentMap.getLayer(LABEL_LAYER_ID)) currentMap.removeLayer(LABEL_LAYER_ID);
        if (currentMap.getLayer(LAYER_ID)) currentMap.removeLayer(LAYER_ID);
        if (currentMap.getSource(SOURCE_ID)) currentMap.removeSource(SOURCE_ID);
      } catch {
        // Map may have been destroyed
      }
      setLayersAdded(false);
    };
  }, [map, isLoaded, onHotspotClick]);

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

  // Update visibility
  useEffect(() => {
    if (!map || !layersAdded) return;

    try {
      const visibility = visible ? 'visible' : 'none';

      if (map.getLayer(LAYER_ID)) {
        map.setLayoutProperty(LAYER_ID, 'visibility', visibility);
      }
      if (map.getLayer(LABEL_LAYER_ID)) {
        map.setLayoutProperty(LABEL_LAYER_ID, 'visibility', visibility);
      }
    } catch {
      // Ignore errors during cleanup
    }
  }, [map, layersAdded, visible]);

  return null;
}
