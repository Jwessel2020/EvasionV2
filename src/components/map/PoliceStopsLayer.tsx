'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useMap } from './MapProvider';
import type mapboxgl from 'mapbox-gl';

interface PoliceStopsLayerProps {
  visible?: boolean;
  lowDetailMode?: boolean; // Force clustered view regardless of zoom
  showAllPoints?: boolean; // Show all points unclustered (performance warning)
  filters?: {
    violationType?: string | null;
    hasAlcohol?: boolean | null;
    hasAccident?: boolean | null;
    hourStart?: number | null;
    hourEnd?: number | null;
    dayOfWeek?: number | null;
  };
  onStopClick?: (properties: Record<string, unknown>) => void;
}

const SOURCE_ID = 'police-stops-source';
const CLUSTER_LAYER_ID = 'police-stops-clusters';
const CLUSTER_COUNT_LAYER_ID = 'police-stops-cluster-count';
const UNCLUSTERED_LAYER_ID = 'police-stops-unclustered';

export function PoliceStopsLayer({
  visible = true,
  lowDetailMode = false,
  showAllPoints = false,
  filters = {},
  onStopClick,
}: PoliceStopsLayerProps) {
  const { map, isLoaded } = useMap();
  const [layersAdded, setLayersAdded] = useState(false);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Fetch data based on current viewport
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
      
      const zoom = Math.floor(map.getZoom());
      
      const params = new URLSearchParams();
      params.set('bounds', `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`);
      params.set('zoom', zoom.toString());
      
      // When showAllPoints is true, request all data without sampling
      if (showAllPoints) {
        params.set('noSampling', 'true');
        params.set('limit', '50000'); // Higher limit for all points view
      }
      
      if (filters.violationType) params.set('violationType', filters.violationType);
      if (filters.hasAlcohol !== null && filters.hasAlcohol !== undefined) {
        params.set('hasAlcohol', filters.hasAlcohol.toString());
      }
      if (filters.hasAccident !== null && filters.hasAccident !== undefined) {
        params.set('hasAccident', filters.hasAccident.toString());
      }
      if (filters.hourStart !== null && filters.hourStart !== undefined) {
        params.set('hourStart', filters.hourStart.toString());
      }
      if (filters.hourEnd !== null && filters.hourEnd !== undefined) {
        params.set('hourEnd', filters.hourEnd.toString());
      }
      if (filters.dayOfWeek !== null && filters.dayOfWeek !== undefined) {
        params.set('dayOfWeek', filters.dayOfWeek.toString());
      }

      const res = await fetch(`/api/analytics/points?${params}`, {
        signal: abortControllerRef.current.signal,
      });
      
      if (!res.ok) return;
      
      const json = await res.json();
      if (json.success) {
        const source = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
        if (source) {
          source.setData(json.data);
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      console.warn('Error fetching police stops:', error);
    }
  }, [map, filters, showAllPoints]);

  // Initialize layers
  useEffect(() => {
    if (!map || !isLoaded) return;
    
    mapRef.current = map;
    
    // Function to add all layers
    const initializeLayers = () => {
      try {
        // Add source with clustering
        // In low detail mode, always cluster (clusterMaxZoom: 22)
        // In normal mode, uncluster at zoom 13
        if (!map.getSource(SOURCE_ID)) {
          map.addSource(SOURCE_ID, {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
            cluster: true,
            clusterMaxZoom: lowDetailMode ? 22 : 13,
            clusterRadius: 80, // Larger radius for better grouping
            clusterMinPoints: 2, // Minimum 2 points to form a cluster
            clusterProperties: {
              // Aggregate properties for cluster info
              alcoholCount: ['+', ['case', ['get', 'alcohol'], 1, 0]],
              accidentCount: ['+', ['case', ['get', 'accident'], 1, 0]],
            },
          });
        }

        // Cluster circles layer with smooth transitions
        if (!map.getLayer(CLUSTER_LAYER_ID)) {
          map.addLayer({
            id: CLUSTER_LAYER_ID,
            type: 'circle',
            source: SOURCE_ID,
            filter: ['has', 'point_count'],
            paint: {
              // Color gradient based on count - logarithmic scale for better distribution
              'circle-color': [
                'interpolate',
                ['linear'],
                ['get', 'point_count'],
                2, '#06b6d4',       // Cyan - very small
                10, '#3b82f6',      // Blue - small
                50, '#8b5cf6',      // Purple - medium
                200, '#f59e0b',     // Amber - large
                500, '#f97316',     // Orange - very large
                1000, '#ef4444',    // Red - huge
                5000, '#dc2626',    // Dark red - massive
              ],
              // Radius uses square root for better visual scaling
              'circle-radius': [
                'interpolate',
                ['linear'],
                ['zoom'],
                6, [
                  'interpolate', ['exponential', 0.5], ['get', 'point_count'],
                  2, 8,
                  50, 14,
                  200, 20,
                  1000, 28,
                  5000, 36
                ],
                9, [
                  'interpolate', ['exponential', 0.5], ['get', 'point_count'],
                  2, 12,
                  50, 18,
                  200, 26,
                  1000, 36,
                  5000, 48
                ],
                12, [
                  'interpolate', ['exponential', 0.5], ['get', 'point_count'],
                  2, 16,
                  50, 24,
                  200, 34,
                  1000, 46,
                  5000, 60
                ],
                15, [
                  'interpolate', ['exponential', 0.5], ['get', 'point_count'],
                  2, 20,
                  50, 30,
                  200, 42,
                  1000, 56,
                  5000, 72
                ],
              ],
              'circle-stroke-width': [
                'interpolate',
                ['linear'],
                ['zoom'],
                6, 1,
                12, 2,
                15, 3,
              ],
              'circle-stroke-color': '#ffffff',
              'circle-opacity': 0.85,
              // Smooth transitions
              'circle-opacity-transition': { duration: 250 },
              'circle-radius-transition': { duration: 250 },
            },
          });
        }

        // Cluster count labels
        if (!map.getLayer(CLUSTER_COUNT_LAYER_ID)) {
          map.addLayer({
            id: CLUSTER_COUNT_LAYER_ID,
            type: 'symbol',
            source: SOURCE_ID,
            filter: ['has', 'point_count'],
            layout: {
              'text-field': ['get', 'point_count_abbreviated'],
              'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
              'text-size': 12,
            },
            paint: {
              'text-color': '#000',
            },
          });
        }

        // Individual points layer - appears at zoom 13+ (hidden in low detail mode)
        if (!map.getLayer(UNCLUSTERED_LAYER_ID)) {
          map.addLayer({
            id: UNCLUSTERED_LAYER_ID,
            type: 'circle',
            source: SOURCE_ID,
            filter: ['!', ['has', 'point_count']],
            paint: {
              'circle-color': [
                'case',
                ['get', 'alcohol'], '#ef4444',      // Red for alcohol
                ['get', 'accident'], '#f97316',     // Orange for accident  
                ['==', ['get', 'violationType'], 'Citation'], '#3b82f6', // Blue
                ['==', ['get', 'violationType'], 'Warning'], '#22c55e',  // Green
                '#8b5cf6',  // Purple default
              ],
              // Smooth radius scaling with zoom
              'circle-radius': [
                'interpolate',
                ['exponential', 1.5],
                ['zoom'],
                13, 5,
                15, 8,
                17, 12,
                19, 18,
              ],
              'circle-stroke-width': [
                'interpolate',
                ['linear'],
                ['zoom'],
                13, 1,
                17, 2,
              ],
              'circle-stroke-color': '#fff',
              // Fade in smoothly (but hidden in low detail mode via visibility)
              'circle-opacity': 0.9,
              // Smooth transitions
              'circle-opacity-transition': { duration: 200 },
              'circle-radius-transition': { duration: 200 },
            },
          });
        }

        setLayersAdded(true);
      } catch (error) {
        console.warn('Error adding police stops layers:', error);
      }
    };

    // Click handlers
    const handleClusterClick = (e: mapboxgl.MapLayerMouseEvent) => {
      try {
        const features = map.queryRenderedFeatures(e.point, { layers: [CLUSTER_LAYER_ID] });
        if (!features.length) return;
        
        const clusterId = features[0].properties?.cluster_id;
        const source = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource;
        
        source.getClusterExpansionZoom(clusterId, (err, zoom) => {
          if (err || !zoom) return;
          
          const geometry = features[0].geometry;
          if (geometry.type === 'Point') {
            map.easeTo({
              center: geometry.coordinates as [number, number],
              zoom: zoom,
            });
          }
        });
      } catch {
        // Ignore errors
      }
    };

    const handlePointClick = (e: mapboxgl.MapLayerMouseEvent) => {
      try {
        const features = map.queryRenderedFeatures(e.point, { layers: [UNCLUSTERED_LAYER_ID] });
        if (!features.length) return;
        
        const properties = features[0].properties;
        if (onStopClick && properties) {
          onStopClick(properties);
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

    // Initialize layers - wait for style to be loaded
    if (map.isStyleLoaded()) {
      initializeLayers();
    } else {
      map.once('style.load', initializeLayers);
    }

    // Add event listeners after a short delay to ensure layers exist
    const setupEvents = () => {
      try {
        map.on('click', CLUSTER_LAYER_ID, handleClusterClick);
        map.on('click', UNCLUSTERED_LAYER_ID, handlePointClick);
        map.on('mouseenter', CLUSTER_LAYER_ID, handleMouseEnter);
        map.on('mouseleave', CLUSTER_LAYER_ID, handleMouseLeave);
        map.on('mouseenter', UNCLUSTERED_LAYER_ID, handleMouseEnter);
        map.on('mouseleave', UNCLUSTERED_LAYER_ID, handleMouseLeave);
      } catch {
        // Ignore errors
      }
    };
    
    setTimeout(setupEvents, 100);

    return () => {
      const currentMap = mapRef.current;
      if (!currentMap) return;

      try {
        currentMap.off('click', CLUSTER_LAYER_ID, handleClusterClick);
        currentMap.off('click', UNCLUSTERED_LAYER_ID, handlePointClick);
        currentMap.off('mouseenter', CLUSTER_LAYER_ID, handleMouseEnter);
        currentMap.off('mouseleave', CLUSTER_LAYER_ID, handleMouseLeave);
        currentMap.off('mouseenter', UNCLUSTERED_LAYER_ID, handleMouseEnter);
        currentMap.off('mouseleave', UNCLUSTERED_LAYER_ID, handleMouseLeave);

        if (currentMap.getLayer(UNCLUSTERED_LAYER_ID)) currentMap.removeLayer(UNCLUSTERED_LAYER_ID);
        if (currentMap.getLayer(CLUSTER_COUNT_LAYER_ID)) currentMap.removeLayer(CLUSTER_COUNT_LAYER_ID);
        if (currentMap.getLayer(CLUSTER_LAYER_ID)) currentMap.removeLayer(CLUSTER_LAYER_ID);
        if (currentMap.getSource(SOURCE_ID)) currentMap.removeSource(SOURCE_ID);
      } catch {
        // Map may have been destroyed
      }
      setLayersAdded(false);
    };
  }, [map, isLoaded, onStopClick]);

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
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [map, layersAdded, fetchData]);

  // Update visibility based on mode
  useEffect(() => {
    if (!map || !layersAdded) return;

    try {
      // showAllPoints: hide clusters, show all individual points
      // lowDetailMode: show clusters, hide individual points
      // default: show both (clusters auto-hide at high zoom)
      
      const clusterVisibility = visible && !showAllPoints ? 'visible' : 'none';
      const pointsVisibility = visible && !lowDetailMode ? 'visible' : 'none';
      
      if (map.getLayer(CLUSTER_LAYER_ID)) {
        map.setLayoutProperty(CLUSTER_LAYER_ID, 'visibility', clusterVisibility);
      }
      if (map.getLayer(CLUSTER_COUNT_LAYER_ID)) {
        map.setLayoutProperty(CLUSTER_COUNT_LAYER_ID, 'visibility', clusterVisibility);
      }
      if (map.getLayer(UNCLUSTERED_LAYER_ID)) {
        map.setLayoutProperty(UNCLUSTERED_LAYER_ID, 'visibility', pointsVisibility);
        
        // When showAllPoints is true, remove the minzoom restriction
        if (showAllPoints) {
          map.setLayerZoomRange(UNCLUSTERED_LAYER_ID, 0, 24);
        } else {
          // Restore normal minzoom (points visible at zoom 13+)
          map.setLayerZoomRange(UNCLUSTERED_LAYER_ID, 13, 24);
        }
      }
    } catch {
      // Ignore errors
    }
  }, [map, layersAdded, visible, lowDetailMode, showAllPoints]);

  // Refetch when filters change
  useEffect(() => {
    if (layersAdded) {
      fetchData();
    }
  }, [layersAdded, fetchData]);

  return null;
}
