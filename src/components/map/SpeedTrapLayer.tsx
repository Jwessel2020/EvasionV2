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
const MARKER_IMAGE_ID = 'speed-trap-marker';

// Custom SVG marker - a red pin with a radar/camera icon
const SPEED_TRAP_MARKER_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="40" height="52" viewBox="0 0 40 52">
  <!-- Pin shadow -->
  <ellipse cx="20" cy="49" rx="8" ry="3" fill="rgba(0,0,0,0.3)"/>
  <!-- Pin body -->
  <path d="M20 0C9 0 0 9 0 20c0 11 20 30 20 30s20-19 20-30C40 9 31 0 20 0z" fill="#dc2626"/>
  <!-- Pin border -->
  <path d="M20 0C9 0 0 9 0 20c0 11 20 30 20 30s20-19 20-30C40 9 31 0 20 0z" fill="none" stroke="#fff" stroke-width="2"/>
  <!-- Inner circle background -->
  <circle cx="20" cy="18" r="12" fill="#fff"/>
  <!-- Radar/Camera icon -->
  <g transform="translate(11, 9)">
    <!-- Camera body -->
    <rect x="1" y="6" width="16" height="10" rx="2" fill="#dc2626"/>
    <!-- Camera lens -->
    <circle cx="9" cy="11" r="4" fill="#fff"/>
    <circle cx="9" cy="11" r="2.5" fill="#1f2937"/>
    <!-- Flash -->
    <path d="M3 3 L6 6 M15 3 L12 6" stroke="#f97316" stroke-width="2" stroke-linecap="round"/>
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
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/8ecbc98d-1e8e-44c9-8f10-253e23d24891',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SpeedTrapLayer.tsx:fetchData',message:'fetchData called',data:{hasMap:!!map},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
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

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/8ecbc98d-1e8e-44c9-8f10-253e23d24891',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SpeedTrapLayer.tsx:fetchData',message:'API request bounds',data:{bounds:params.get('bounds'),minStops,year},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'C'})}).catch(()=>{});
      // #endregion

      const res = await fetch(`/api/analytics/speed-traps?${params}`, {
        signal: abortControllerRef.current.signal,
      });
      
      if (!res.ok) return;
      
      const json = await res.json();
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/8ecbc98d-1e8e-44c9-8f10-253e23d24891',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SpeedTrapLayer.tsx:fetchData',message:'API response',data:{success:json.success,featureCount:json.data?.features?.length,meta:json.meta},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      if (json.success) {
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

  // Load custom marker image
  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/8ecbc98d-1e8e-44c9-8f10-253e23d24891',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SpeedTrapLayer.tsx:imageEffect',message:'Image load effect',data:{hasMap:!!map,isLoaded,imageLoaded},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    if (!map || !isLoaded) return;

    // Check if image already exists
    if (map.hasImage(MARKER_IMAGE_ID)) {
      setImageLoaded(true);
      return;
    }

    const img = new Image();
    img.onload = () => {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/8ecbc98d-1e8e-44c9-8f10-253e23d24891',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SpeedTrapLayer.tsx:img.onload',message:'Image loaded successfully',data:{width:img.width,height:img.height},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      if (!map.hasImage(MARKER_IMAGE_ID)) {
        map.addImage(MARKER_IMAGE_ID, img, { sdf: false });
      }
      setImageLoaded(true);
    };
    img.onerror = (err) => {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/8ecbc98d-1e8e-44c9-8f10-253e23d24891',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SpeedTrapLayer.tsx:img.onerror',message:'Image load FAILED',data:{error:String(err)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      console.warn('Failed to load speed trap marker image, using fallback');
      setImageLoaded(true); // Continue with fallback
    };
    img.src = svgToDataURL(SPEED_TRAP_MARKER_SVG);
  }, [map, isLoaded]);

  // Initialize layers
  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/8ecbc98d-1e8e-44c9-8f10-253e23d24891',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SpeedTrapLayer.tsx:initLayersEffect',message:'Init layers effect triggered',data:{hasMap:!!map,isLoaded,imageLoaded},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    if (!map || !isLoaded || !imageLoaded) return;
    
    mapRef.current = map;
    
    const initializeLayers = () => {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/8ecbc98d-1e8e-44c9-8f10-253e23d24891',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SpeedTrapLayer.tsx:initializeLayers',message:'initializeLayers called',data:{hasCustomImage:map.hasImage(MARKER_IMAGE_ID)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      try {
        // Add source
        if (!map.getSource(SOURCE_ID)) {
          map.addSource(SOURCE_ID, {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          });
        }

        // Add pulsing circle behind markers for emphasis
        if (!map.getLayer(PULSE_LAYER_ID)) {
          map.addLayer({
            id: PULSE_LAYER_ID,
            type: 'circle',
            source: SOURCE_ID,
            paint: {
              'circle-color': '#dc2626',
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
              'circle-stroke-color': '#dc2626',
              'circle-stroke-opacity': 0.3,
            },
          });
        }

        // Check if custom image loaded successfully
        const hasCustomImage = map.hasImage(MARKER_IMAGE_ID);

        if (hasCustomImage) {
          // Add pin/marker layer using custom SVG image
          if (!map.getLayer(LAYER_ID)) {
            map.addLayer({
              id: LAYER_ID,
              type: 'symbol',
              source: SOURCE_ID,
              layout: {
                'icon-image': MARKER_IMAGE_ID,
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

          // Add label with stop count below the pin
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
                'text-halo-color': '#dc2626',
                'text-halo-width': 2,
              },
            });
          }
        } else {
          // Fallback to circle markers if image failed
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/8ecbc98d-1e8e-44c9-8f10-253e23d24891',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SpeedTrapLayer.tsx:initializeLayers',message:'Using fallback - no custom image',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'D'})}).catch(()=>{});
          // #endregion
          addFallbackCircleLayer();
          return;
        }

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/8ecbc98d-1e8e-44c9-8f10-253e23d24891',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SpeedTrapLayer.tsx:initializeLayers',message:'Layers added successfully with custom image',data:{hasLayer:map.getLayer(LAYER_ID)!==undefined},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
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

        // Outer glow/pulse effect
        if (!map.getLayer(PULSE_LAYER_ID)) {
          map.addLayer({
            id: PULSE_LAYER_ID,
            type: 'circle',
            source: SOURCE_ID,
            paint: {
              'circle-color': '#dc2626',
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

        // Main marker - distinctive red circle with thick white border
        if (!map.getLayer(LAYER_ID)) {
          map.addLayer({
            id: LAYER_ID,
            type: 'circle',
            source: SOURCE_ID,
            paint: {
              'circle-color': '#dc2626',
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

        // Text label showing stop count
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
              'text-halo-color': '#dc2626',
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

    // Initialize - isLoaded from context already confirms map is ready
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/8ecbc98d-1e8e-44c9-8f10-253e23d24891',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SpeedTrapLayer.tsx:initCheck',message:'Calling initializeLayers directly',data:{isLoaded},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'D',runId:'post-fix'})}).catch(()=>{});
    // #endregion
    initializeLayers();

    // Add event listeners
    const setupEvents = () => {
      try {
        map.on('click', LAYER_ID, handleClick);
        map.on('mouseenter', LAYER_ID, handleMouseEnter);
        map.on('mouseleave', LAYER_ID, handleMouseLeave);
      } catch {
        // Ignore errors
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
