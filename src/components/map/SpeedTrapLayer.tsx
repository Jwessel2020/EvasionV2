'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useMap } from './MapProvider';
import type mapboxgl from 'mapbox-gl';

interface SpeedTrapLayerProps {
  visible?: boolean;
  year?: number | null;
  minStops?: number;
  onTrapClick?: (properties: Record<string, unknown>) => void;
}

const SOURCE_ID = 'speed-traps-source';
const LAYER_ID = 'speed-traps-layer';
const LABEL_LAYER_ID = 'speed-traps-labels';
const PULSE_LAYER_ID = 'speed-traps-pulse';

// Detection method color mappings (lowercase to match database values)
const DETECTION_METHOD_COLORS: Record<string, { color: string; imageId: string }> = {
  'radar': { color: '#3b82f6', imageId: 'speed-trap-radar' },      // Blue
  'laser': { color: '#dc2626', imageId: 'speed-trap-laser' },      // Red
  'vascar': { color: '#eab308', imageId: 'speed-trap-vascar' },    // Yellow
  'patrol': { color: '#22c55e', imageId: 'speed-trap-patrol' },    // Green
  'automated': { color: '#8b5cf6', imageId: 'speed-trap-automated' }, // Purple
  'default': { color: '#6b7280', imageId: 'speed-trap-default' },  // Gray
};

// Custom SVG marker generator - creates a pin with detection method color
const createSpeedTrapMarkerSVG = (color: string): string => `
<svg xmlns="http://www.w3.org/2000/svg" width="40" height="52" viewBox="0 0 40 52">
  <!-- Pin shadow -->
  <ellipse cx="20" cy="49" rx="8" ry="3" fill="rgba(0,0,0,0.3)"/>
  <!-- Pin body -->
  <path d="M20 0C9 0 0 9 0 20c0 11 20 30 20 30s20-19 20-30C40 9 31 0 20 0z" fill="${color}"/>
  <!-- Pin border -->
  <path d="M20 0C9 0 0 9 0 20c0 11 20 30 20 30s20-19 20-30C40 9 31 0 20 0z" fill="none" stroke="#fff" stroke-width="2"/>
  <!-- Inner circle background -->
  <circle cx="20" cy="18" r="12" fill="#fff"/>
  <!-- Radar/Camera icon -->
  <g transform="translate(11, 9)">
    <!-- Camera body -->
    <rect x="1" y="6" width="16" height="10" rx="2" fill="${color}"/>
    <!-- Camera lens -->
    <circle cx="9" cy="11" r="4" fill="#fff"/>
    <circle cx="9" cy="11" r="2.5" fill="#1f2937"/>
    <!-- Flash -->
    <path d="M3 3 L6 6 M15 3 L12 6" stroke="#a855f7" stroke-width="2" stroke-linecap="round"/>
    <circle cx="3" cy="2" r="1.5" fill="#fbbf24"/>
    <circle cx="15" cy="2" r="1.5" fill="#fbbf24"/>
  </g>
</svg>
`;

// Convert SVG to data URL for Mapbox
const svgToDataURL = (svg: string): string => {
  const encoded = btoa(unescape(encodeURIComponent(svg)));
  return `data:image/svg+xml;base64,${encoded}`;
};

export function SpeedTrapLayer({
  visible = true,
  year = null,
  minStops = 5,
  onTrapClick,
}: SpeedTrapLayerProps) {
  const { map, isLoaded } = useMap();
  const [layersAdded, setLayersAdded] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const onTrapClickRef = useRef(onTrapClick);

  // Keep the callback ref up to date without triggering re-renders
  useEffect(() => {
    onTrapClickRef.current = onTrapClick;
  }, [onTrapClick]);

  // Fetch speed trap data
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
      if (year) {
        params.set('year', year.toString());
      }

      const res = await fetch(`/api/analytics/speed-traps?${params}`, {
        signal: abortControllerRef.current.signal,
      });

      if (!res.ok) return;

      const json = await res.json();
      if (json.success && json.data?.features?.length > 0) {
        // Only update data if we got results - don't clear existing markers
        // when zoomed into an area with no traps
        const source = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
        if (source) {
          source.setData(json.data);
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      console.warn('Error fetching speed traps:', error);
    }
  }, [map, year, minStops]);

  // Load custom marker images (one for each detection method)
  useEffect(() => {
    if (!map || !isLoaded) return;

    // Load all detection method marker images
    const loadImages = async () => {
      const loadPromises = Object.values(DETECTION_METHOD_COLORS).map(({ color, imageId }) => {
        return new Promise<void>((resolve) => {
          // Check if image already exists
          if (map.hasImage(imageId)) {
            resolve();
            return;
          }

          const img = new Image();
          img.onload = () => {
            if (!map.hasImage(imageId)) {
              map.addImage(imageId, img, { sdf: false });
            }
            resolve();
          };
          img.onerror = () => {
            console.warn(`Failed to load speed trap marker image: ${imageId}`);
            resolve(); // Continue even if one fails
          };
          img.src = svgToDataURL(createSpeedTrapMarkerSVG(color));
        });
      });

      await Promise.all(loadPromises);
      setImageLoaded(true);
    };

    loadImages();
  }, [map, isLoaded]);

  // Initialize layers
  useEffect(() => {
    if (!map || !isLoaded || !imageLoaded) return;

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

        // Add pulsing circle behind markers for emphasis (color matches detection method)
        if (!map.getLayer(PULSE_LAYER_ID)) {
          map.addLayer({
            id: PULSE_LAYER_ID,
            type: 'circle',
            source: SOURCE_ID,
            paint: {
              'circle-color': [
                'match',
                ['get', 'primaryMethod'],
                'radar', '#3b82f6',
                'laser', '#dc2626',
                'vascar', '#eab308',
                'patrol', '#22c55e',
                'automated', '#8b5cf6',
                '#6b7280', // default gray
              ],
              'circle-radius': [
                'interpolate',
                ['linear'],
                ['zoom'],
                8, 10,
                12, 14,
                16, 36,
              ],
              'circle-opacity': 0.15,
              'circle-stroke-width': 2,
              'circle-stroke-color': [
                'match',
                ['get', 'primaryMethod'],
                'radar', '#3b82f6',
                'laser', '#dc2626',
                'vascar', '#eab308',
                'patrol', '#22c55e',
                'automated', '#8b5cf6',
                '#6b7280', // default gray
              ],
              'circle-stroke-opacity': 0.3,
            },
          });
        }

        // Check if at least one custom image loaded successfully
        const hasCustomImage = map.hasImage(DETECTION_METHOD_COLORS.default.imageId);

        if (hasCustomImage) {
          // Add pin/marker layer using custom SVG images (color-coded by detection method)
          if (!map.getLayer(LAYER_ID)) {
            map.addLayer({
              id: LAYER_ID,
              type: 'symbol',
              source: SOURCE_ID,
              layout: {
                'icon-image': [
                  'match',
                  ['get', 'primaryMethod'],
                  'radar', DETECTION_METHOD_COLORS.radar.imageId,
                  'laser', DETECTION_METHOD_COLORS.laser.imageId,
                  'vascar', DETECTION_METHOD_COLORS.vascar.imageId,
                  'patrol', DETECTION_METHOD_COLORS.patrol.imageId,
                  'automated', DETECTION_METHOD_COLORS.automated.imageId,
                  DETECTION_METHOD_COLORS.default.imageId, // default
                ],
                'icon-size': [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  8, 0.3,
                  12, 0.45,
                  16, 1.2,
                ],
                'icon-allow-overlap': true,
                'icon-anchor': 'bottom',
                'symbol-sort-key': ['get', 'trapScore'], // Higher scores on top
              },
              paint: {
                'icon-opacity': 1,
              },
            });
          }

          // Add label with stop count below the pin (color matches detection method)
          if (!map.getLayer(LABEL_LAYER_ID)) {
            map.addLayer({
              id: LABEL_LAYER_ID,
              type: 'symbol',
              source: SOURCE_ID,
              layout: {
                'text-field': ['concat', ['get', 'stopCount'], ' stops'],
                'text-font': ['DIN Offc Pro Bold', 'Arial Unicode MS Bold'],
                'text-size': [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  8, 9,
                  12, 11,
                  16, 13,
                ],
                'text-offset': [0, 1.2],
                'text-anchor': 'top',
                'text-allow-overlap': false,
              },
              paint: {
                'text-color': '#fff',
                'text-halo-color': [
                  'match',
                  ['get', 'primaryMethod'],
                  'radar', '#3b82f6',
                  'laser', '#dc2626',
                  'vascar', '#eab308',
                  'patrol', '#22c55e',
                  'automated', '#8b5cf6',
                  '#6b7280', // default gray
                ],
                'text-halo-width': 2,
              },
            });
          }
        } else {
          // Fallback to circle markers if image failed
          addFallbackCircleLayer();
          return;
        }

        setLayersAdded(true);
      } catch (error) {
        console.warn('Error adding speed trap layers, trying fallback:', error);
        addFallbackCircleLayer();
      }
    };

    // Fallback circle layer with distinct styling (diamond-like appearance)
    const addFallbackCircleLayer = () => {
      try {
        if (!map.getSource(SOURCE_ID)) {
          map.addSource(SOURCE_ID, {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          });
        }

        // Outer glow/pulse effect (color-coded by detection method)
        if (!map.getLayer(PULSE_LAYER_ID)) {
          map.addLayer({
            id: PULSE_LAYER_ID,
            type: 'circle',
            source: SOURCE_ID,
            paint: {
              'circle-color': [
                'match',
                ['get', 'primaryMethod'],
                'radar', '#3b82f6',
                'laser', '#dc2626',
                'vascar', '#eab308',
                'patrol', '#22c55e',
                'automated', '#8b5cf6',
                '#6b7280', // default gray
              ],
              'circle-radius': [
                'interpolate',
                ['linear'],
                ['get', 'stopCount'],
                5, 11,
                20, 14,
                50, 34,
                100, 42,
              ],
              'circle-opacity': 0.2,
            },
          });
        }

        // Main marker - distinctive circle with thick white border (color-coded by detection method)
        if (!map.getLayer(LAYER_ID)) {
          map.addLayer({
            id: LAYER_ID,
            type: 'circle',
            source: SOURCE_ID,
            paint: {
              'circle-color': [
                'match',
                ['get', 'primaryMethod'],
                'radar', '#3b82f6',
                'laser', '#dc2626',
                'vascar', '#eab308',
                'patrol', '#22c55e',
                'automated', '#8b5cf6',
                '#6b7280', // default gray
              ],
              'circle-radius': [
                'interpolate',
                ['linear'],
                ['get', 'stopCount'],
                5, 7,
                20, 9,
                50, 22,
                100, 28,
              ],
              'circle-stroke-width': 4,
              'circle-stroke-color': '#fff',
              'circle-opacity': 1,
            },
          });
        }

        // Inner white circle (camera lens effect)
        if (!map.getLayer(LAYER_ID + '-inner')) {
          map.addLayer({
            id: LAYER_ID + '-inner',
            type: 'circle',
            source: SOURCE_ID,
            paint: {
              'circle-color': '#fff',
              'circle-radius': [
                'interpolate',
                ['linear'],
                ['get', 'stopCount'],
                5, 1.5,
                20, 2,
                50, 5,
                100, 6,
              ],
              'circle-opacity': 1,
            },
          });
        }

        // Center dot (camera lens center)
        if (!map.getLayer(LAYER_ID + '-center')) {
          map.addLayer({
            id: LAYER_ID + '-center',
            type: 'circle',
            source: SOURCE_ID,
            paint: {
              'circle-color': '#1f2937',
              'circle-radius': [
                'interpolate',
                ['linear'],
                ['get', 'stopCount'],
                5, 0.75,
                20, 1,
                50, 2.5,
                100, 3,
              ],
              'circle-opacity': 1,
            },
          });
        }

        // Text label showing stop count (color-coded by detection method)
        if (!map.getLayer(LABEL_LAYER_ID)) {
          map.addLayer({
            id: LABEL_LAYER_ID,
            type: 'symbol',
            source: SOURCE_ID,
            layout: {
              'text-field': ['concat', ['get', 'stopCount'], ' stops'],
              'text-font': ['DIN Offc Pro Bold', 'Arial Unicode MS Bold'],
              'text-size': [
                'interpolate',
                ['linear'],
                ['zoom'],
                8, 9,
                12, 11,
                16, 13,
              ],
              'text-offset': [0, 2.5],
              'text-anchor': 'top',
              'text-allow-overlap': false,
            },
            paint: {
              'text-color': '#fff',
              'text-halo-color': [
                'match',
                ['get', 'primaryMethod'],
                'RADAR', '#3b82f6',
                'LASER', '#dc2626',
                'VASCAR', '#eab308',
                'PATROL', '#22c55e',
                'AUTOMATED', '#8b5cf6',
                '#6b7280', // default gray
              ],
              'text-halo-width': 2,
            },
          });
        }

        setLayersAdded(true);
      } catch (error) {
        console.error('Error adding fallback speed trap layers:', error);
      }
    };

    // Click handler - uses ref to avoid triggering re-init when callback changes
    const handleClick = (e: mapboxgl.MapLayerMouseEvent) => {
      try {
        const features = map.queryRenderedFeatures(e.point, { layers: [LAYER_ID] });
        if (!features.length) return;

        const properties = features[0].properties;
        if (onTrapClickRef.current && properties) {
          // Parse any stringified arrays
          const parsed = { ...properties };
          if (typeof parsed.activeHours === 'string') {
            try {
              parsed.activeHours = JSON.parse(parsed.activeHours);
            } catch {
              // Keep as string
            }
          }
          onTrapClickRef.current(parsed);
        }
      } catch {
        // Ignore errors
      }
    };

    const handleMouseEnter = () => {
      map.getCanvas().style.cursor = 'pointer';
    };

    const handleMouseLeave = () => {
      map.getCanvas().style.cursor = '';
    };

    // Initialize layers
    initializeLayers();

    // Add event listeners
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

        // Remove all layers in reverse order
        if (currentMap.getLayer(LABEL_LAYER_ID)) currentMap.removeLayer(LABEL_LAYER_ID);
        if (currentMap.getLayer(LAYER_ID + '-center')) currentMap.removeLayer(LAYER_ID + '-center');
        if (currentMap.getLayer(LAYER_ID + '-inner')) currentMap.removeLayer(LAYER_ID + '-inner');
        if (currentMap.getLayer(LAYER_ID)) currentMap.removeLayer(LAYER_ID);
        if (currentMap.getLayer(PULSE_LAYER_ID)) currentMap.removeLayer(PULSE_LAYER_ID);
        if (currentMap.getSource(SOURCE_ID)) currentMap.removeSource(SOURCE_ID);
      } catch {
        // Map may have been destroyed
      }
      setLayersAdded(false);
    };
  }, [map, isLoaded, imageLoaded]);

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

  // Refetch when year changes
  useEffect(() => {
    if (layersAdded) {
      fetchData();
    }
  }, [layersAdded, fetchData, year, minStops]);

  // Update visibility
  useEffect(() => {
    if (!map || !layersAdded) return;

    try {
      const visibility = visible ? 'visible' : 'none';

      // Update all speed trap layers
      const layersToUpdate = [
        PULSE_LAYER_ID,
        LAYER_ID,
        LAYER_ID + '-inner',
        LAYER_ID + '-center',
        LABEL_LAYER_ID,
      ];

      layersToUpdate.forEach(layerId => {
        if (map.getLayer(layerId)) {
          map.setLayoutProperty(layerId, 'visibility', visibility);
        }
      });
    } catch {
      // Ignore errors
    }
  }, [map, layersAdded, visible]);

  return null;
}
