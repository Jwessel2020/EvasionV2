'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useMap } from './MapProvider';
import type mapboxgl from 'mapbox-gl';

interface CarSpotting {
  id: string;
  make: string;
  model: string;
  color?: string;
  year?: number;
  thumbnail?: string;
  spottedAt: string;
  spotter: string;
  likeCount: number;
  viewCount: number;
}

interface CarSpottingLayerProps {
  visible?: boolean;
  dateFrom?: string | null;
  dateTo?: string | null;
  onSpotClick?: (spotting: CarSpotting & { lat: number; lng: number }) => void;
}

const SOURCE_ID = 'car-spottings-source';
const LAYER_ID = 'car-spottings-layer';
const LABEL_LAYER_ID = 'car-spottings-labels';
const PULSE_LAYER_ID = 'car-spottings-pulse';

// Color palette for car colors
const CAR_COLOR_MAP: Record<string, string> = {
  red: '#ef4444',
  blue: '#3b82f6',
  green: '#22c55e',
  yellow: '#eab308',
  orange: '#f97316', // Keep actual orange for car color
  purple: '#a855f7',
  pink: '#ec4899',
  white: '#f8fafc',
  black: '#1f2937',
  gray: '#6b7280',
  grey: '#6b7280',
  silver: '#94a3b8',
  gold: '#fbbf24',
  brown: '#92400e',
  default: '#8b5cf6',
};

function getCarColor(colorName?: string): string {
  if (!colorName) return CAR_COLOR_MAP.default;
  const key = colorName.toLowerCase().trim();
  return CAR_COLOR_MAP[key] || CAR_COLOR_MAP.default;
}

// Car emoji based on make (simplified)
function getCarEmoji(make?: string): string {
  const lowerMake = (make || '').toLowerCase();
  if (lowerMake.includes('ferrari') || lowerMake.includes('lamborghini') || lowerMake.includes('porsche')) return '🏎️';
  if (lowerMake.includes('truck') || lowerMake.includes('ford f') || lowerMake.includes('ram')) return '🛻';
  if (lowerMake.includes('tesla')) return '🔋';
  if (lowerMake.includes('jeep')) return '🚙';
  if (lowerMake.includes('motorcycle') || lowerMake.includes('harley') || lowerMake.includes('ducati')) return '🏍️';
  return '🚗';
}

export function CarSpottingLayer({
  visible = true,
  dateFrom = null,
  dateTo = null,
  onSpotClick,
}: CarSpottingLayerProps) {
  const { map, isLoaded } = useMap();
  const [layersAdded, setLayersAdded] = useState(false);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const onSpotClickRef = useRef(onSpotClick);

  // Keep callback ref up to date
  useEffect(() => {
    onSpotClickRef.current = onSpotClick;
  }, [onSpotClick]);

  // Fetch car spotting data
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
      params.set('format', 'geojson');
      params.set('limit', '100');
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);

      const res = await fetch(`/api/car-spotting?${params}`, {
        signal: abortControllerRef.current.signal,
      });

      if (!res.ok) return;

      const json = await res.json();

      if (json.success && json.data?.features) {
        const source = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
        if (source) {
          // Add car color to properties for styling
          const features = json.data.features.map((f: GeoJSON.Feature) => ({
            ...f,
            properties: {
              ...f.properties,
              markerColor: getCarColor(f.properties?.color),
              carEmoji: getCarEmoji(f.properties?.make),
            },
          }));
          source.setData({ type: 'FeatureCollection', features });
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      console.warn('Error fetching car spottings:', error);
    }
  }, [map, dateFrom, dateTo]);

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

        // Outer pulse/glow effect
        if (!map.getLayer(PULSE_LAYER_ID)) {
          map.addLayer({
            id: PULSE_LAYER_ID,
            type: 'circle',
            source: SOURCE_ID,
            paint: {
              'circle-color': ['get', 'markerColor'],
              'circle-radius': [
                'interpolate',
                ['linear'],
                ['zoom'],
                8, 12,
                12, 16,
                16, 24,
              ],
              'circle-opacity': 0.2,
              'circle-stroke-width': 2,
              'circle-stroke-color': ['get', 'markerColor'],
              'circle-stroke-opacity': 0.4,
            },
          });
        }

        // Main marker circle
        if (!map.getLayer(LAYER_ID)) {
          map.addLayer({
            id: LAYER_ID,
            type: 'circle',
            source: SOURCE_ID,
            paint: {
              'circle-color': ['get', 'markerColor'],
              'circle-radius': [
                'interpolate',
                ['linear'],
                ['zoom'],
                8, 6,
                12, 10,
                16, 16,
              ],
              'circle-stroke-width': 3,
              'circle-stroke-color': '#fff',
              'circle-opacity': 0.95,
            },
          });
        }

        // Label layer showing make/model
        if (!map.getLayer(LABEL_LAYER_ID)) {
          map.addLayer({
            id: LABEL_LAYER_ID,
            type: 'symbol',
            source: SOURCE_ID,
            layout: {
              'text-field': ['concat', ['get', 'make'], ' ', ['get', 'model']],
              'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
              'text-size': 11,
              'text-offset': [0, 1.8],
              'text-anchor': 'top',
              'text-allow-overlap': false,
              'text-max-width': 12,
            },
            paint: {
              'text-color': '#fff',
              'text-halo-color': ['get', 'markerColor'],
              'text-halo-width': 2,
            },
            minzoom: 11,
          });
        }

        setLayersAdded(true);
      } catch (error) {
        console.error('Error adding car spotting layers:', error);
      }
    };

    // Click handler
    const handleClick = (e: mapboxgl.MapLayerMouseEvent) => {
      if (!e.features || e.features.length === 0) return;

      const feature = e.features[0];
      const props = feature.properties;
      const coords = (feature.geometry as GeoJSON.Point).coordinates;

      if (props && onSpotClickRef.current) {
        onSpotClickRef.current({
          id: props.id,
          make: props.make,
          model: props.model,
          color: props.color,
          year: props.year,
          thumbnail: props.thumbnail,
          spottedAt: props.spottedAt,
          spotter: props.spotter,
          likeCount: props.likeCount || 0,
          viewCount: props.viewCount || 0,
          lat: coords[1],
          lng: coords[0],
        });
      }
    };

    const handleMouseEnter = () => {
      map.getCanvas().style.cursor = 'pointer';
    };

    const handleMouseLeave = () => {
      map.getCanvas().style.cursor = '';
    };

    initializeLayers();

    // Setup events after short delay to ensure layers exist
    const setupEvents = () => {
      try {
        map.on('click', LAYER_ID, handleClick);
        map.on('mouseenter', LAYER_ID, handleMouseEnter);
        map.on('mouseleave', LAYER_ID, handleMouseLeave);
      } catch {
        // Layer may not exist yet
      }
    };

    setTimeout(setupEvents, 100);

    return () => {
      const currentMap = mapRef.current;
      if (!currentMap) return;

      try {
        currentMap.off('click', LAYER_ID, handleClick);
        currentMap.off('mouseenter', LAYER_ID, handleMouseEnter);
        currentMap.off('mouseleave', LAYER_ID, handleMouseLeave);

        if (currentMap.getLayer(LABEL_LAYER_ID)) currentMap.removeLayer(LABEL_LAYER_ID);
        if (currentMap.getLayer(LAYER_ID)) currentMap.removeLayer(LAYER_ID);
        if (currentMap.getLayer(PULSE_LAYER_ID)) currentMap.removeLayer(PULSE_LAYER_ID);
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

  // Refetch when date filters change
  useEffect(() => {
    if (layersAdded) {
      fetchData();
    }
  }, [layersAdded, fetchData, dateFrom, dateTo]);

  // Update visibility
  useEffect(() => {
    if (!map || !layersAdded) return;

    try {
      const visibility = visible ? 'visible' : 'none';

      if (map.getLayer(PULSE_LAYER_ID)) {
        map.setLayoutProperty(PULSE_LAYER_ID, 'visibility', visibility);
      }
      if (map.getLayer(LAYER_ID)) {
        map.setLayoutProperty(LAYER_ID, 'visibility', visibility);
      }
      if (map.getLayer(LABEL_LAYER_ID)) {
        map.setLayoutProperty(LABEL_LAYER_ID, 'visibility', visibility);
      }
    } catch {
      // Ignore errors during visibility toggle
    }
  }, [map, layersAdded, visible]);

  return null;
}
