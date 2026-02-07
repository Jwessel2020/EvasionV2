'use client';

import { useEffect, useState, useRef } from 'react';
import { useMap } from './MapProvider';
import type mapboxgl from 'mapbox-gl';

interface PatternLocation {
  gridId: string;
  lat: number;
  lng: number;
}

interface PatternStyle {
  icon: string;
  color: string;
  borderColor: string;
}

interface PatternData {
  id: string;
  type: string;
  name: string;
  description: string;
  locationCount: number;
  style: PatternStyle;
}

interface PatternMarkersLayerProps {
  visible?: boolean;
  selectedPatternId?: string | null;
  onPatternLocationClick?: (location: PatternLocation, pattern: PatternData) => void;
}

const SOURCE_ID = 'pattern-markers-source';
const LAYER_ID = 'pattern-markers-layer';
const LABEL_LAYER_ID = 'pattern-markers-labels';
const PULSE_LAYER_ID = 'pattern-markers-pulse';

export function PatternMarkersLayer({
  visible = true,
  selectedPatternId = null,
  onPatternLocationClick,
}: PatternMarkersLayerProps) {
  const { map, isLoaded } = useMap();
  const [layersAdded, setLayersAdded] = useState(false);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Use refs for values that shouldn't trigger re-renders
  const onClickRef = useRef(onPatternLocationClick);
  const patternDataRef = useRef<PatternData | null>(null);

  // Keep callback ref updated
  useEffect(() => {
    onClickRef.current = onPatternLocationClick;
  }, [onPatternLocationClick]);

  // Initialize layers - NO patternData in deps!
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

        // Add pulse/glow layer
        if (!map.getLayer(PULSE_LAYER_ID)) {
          map.addLayer({
            id: PULSE_LAYER_ID,
            type: 'circle',
            source: SOURCE_ID,
            paint: {
              'circle-color': ['get', 'color'],
              'circle-radius': [
                'interpolate',
                ['linear'],
                ['zoom'],
                8, 14,
                12, 18,
                16, 28,
              ],
              'circle-opacity': 0.25,
              'circle-stroke-width': 2,
              'circle-stroke-color': ['get', 'color'],
              'circle-stroke-opacity': 0.5,
            },
          });
        }

        // Add main marker layer
        if (!map.getLayer(LAYER_ID)) {
          map.addLayer({
            id: LAYER_ID,
            type: 'circle',
            source: SOURCE_ID,
            paint: {
              'circle-color': ['get', 'color'],
              'circle-radius': [
                'interpolate',
                ['linear'],
                ['zoom'],
                8, 8,
                12, 10,
                16, 14,
              ],
              'circle-stroke-width': 3,
              'circle-stroke-color': '#fff',
              'circle-opacity': 0.95,
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
              'text-field': ['get', 'patternName'],
              'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
              'text-size': 11,
              'text-offset': [0, 1.8],
              'text-anchor': 'top',
              'text-allow-overlap': false,
              'text-max-width': 12,
            },
            paint: {
              'text-color': '#fff',
              'text-halo-color': ['get', 'color'],
              'text-halo-width': 2,
            },
            minzoom: 11,
          });
        }

        setLayersAdded(true);
      } catch (error) {
        console.error('Error adding pattern marker layers:', error);
      }
    };

    // Click handler - uses ref for patternData
    const handleClick = (e: mapboxgl.MapLayerMouseEvent) => {
      if (!e.features || e.features.length === 0) return;

      const props = e.features[0].properties;
      if (props && onClickRef.current && patternDataRef.current) {
        onClickRef.current(
          {
            gridId: props.gridId,
            lat: props.lat,
            lng: props.lng,
          },
          patternDataRef.current
        );
      }
    };

    const handleMouseEnter = () => {
      map.getCanvas().style.cursor = 'pointer';
    };

    const handleMouseLeave = () => {
      map.getCanvas().style.cursor = '';
    };

    initializeLayers();

    // Setup events after layers are added
    const setupEvents = () => {
      try {
        map.on('click', LAYER_ID, handleClick);
        map.on('mouseenter', LAYER_ID, handleMouseEnter);
        map.on('mouseleave', LAYER_ID, handleMouseLeave);
      } catch {
        // Ignore errors if layer doesn't exist yet
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
  }, [map, isLoaded]); // FIXED: No patternData in deps!

  // Data fetch effect - separate from initialization
  useEffect(() => {
    if (!map || !layersAdded) return;

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const fetchPatternLocations = async () => {
      if (!selectedPatternId) {
        // Clear markers if no pattern selected
        try {
          const source = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
          if (source) {
            source.setData({ type: 'FeatureCollection', features: [] });
          }
        } catch {
          // Ignore
        }
        patternDataRef.current = null;
        return;
      }

      try {
        const bounds = map.getBounds();
        if (!bounds) return;

        const params = new URLSearchParams();
        params.set('patternId', selectedPatternId);
        params.set('bounds', `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`);

        const res = await fetch(`/api/insights/ml/patterns?${params}`, {
          signal: controller.signal,
        });

        if (!res.ok) return;

        const json = await res.json();

        if (json.success && json.data?.locations) {
          const { pattern, locations } = json.data;

          // Store pattern data in ref for click handler
          patternDataRef.current = pattern;

          // Only update if we got locations
          if (locations.length > 0) {
            const features: GeoJSON.Feature[] = locations.map((loc: PatternLocation) => ({
              type: 'Feature' as const,
              geometry: {
                type: 'Point' as const,
                coordinates: [loc.lng, loc.lat],
              },
              properties: {
                gridId: loc.gridId,
                lat: loc.lat,
                lng: loc.lng,
                patternId: pattern.id,
                patternName: pattern.name,
                patternType: pattern.type,
                color: pattern.style.color,
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
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return;
        console.warn('Error fetching pattern locations:', error);
      }
    };

    // Initial fetch
    fetchPatternLocations();

    // Fetch on map move (debounced)
    let timeout: NodeJS.Timeout;
    const handleMoveEnd = () => {
      clearTimeout(timeout);
      timeout = setTimeout(fetchPatternLocations, 300);
    };

    map.on('moveend', handleMoveEnd);

    return () => {
      controller.abort();
      clearTimeout(timeout);
      map.off('moveend', handleMoveEnd);
    };
  }, [map, layersAdded, selectedPatternId]); // FIXED: Only stable deps + selectedPatternId

  // Update visibility
  useEffect(() => {
    if (!map || !layersAdded) return;

    try {
      const visibility = visible && selectedPatternId ? 'visible' : 'none';

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
      // Ignore errors during cleanup
    }
  }, [map, layersAdded, visible, selectedPatternId]);

  return null;
}
