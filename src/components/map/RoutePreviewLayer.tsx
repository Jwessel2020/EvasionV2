'use client';

import { useEffect, useRef } from 'react';
import { useMap } from './MapProvider';

interface RoutePreviewLayerProps {
  id: string;
  coordinates: [number, number][];
  isCalculating?: boolean;
  color?: string;
  outlineColor?: string;
  width?: number;
  outlineWidth?: number;
  opacity?: number;
}

export function RoutePreviewLayer({
  id,
  coordinates,
  isCalculating = false,
  color = '#8b5cf6', // Violet-500
  outlineColor = '#4c1d95', // Violet-900
  width = 6,
  outlineWidth = 8,
  opacity = 0.9,
}: RoutePreviewLayerProps) {
  const { map, isLoaded } = useMap();
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    if (!map || !isLoaded) return;

    const sourceId = `route-preview-source-${id}`;
    const outlineLayerId = `route-preview-outline-${id}`;
    const mainLayerId = `route-preview-main-${id}`;
    const casingLayerId = `route-preview-casing-${id}`;

    // Create GeoJSON data
    const geojsonData: GeoJSON.Feature = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: coordinates.length >= 2 ? coordinates : [],
      },
    };

    // Add or update source
    if (!map.getSource(sourceId)) {
      map.addSource(sourceId, {
        type: 'geojson',
        data: geojsonData,
        lineMetrics: true, // Enable for gradient/animation effects
      });
    } else {
      const source = map.getSource(sourceId) as mapboxgl.GeoJSONSource;
      source.setData(geojsonData);
    }

    // Add layers if they don't exist
    if (!map.getLayer(casingLayerId) && coordinates.length >= 2) {
      // Casing layer (outer glow effect)
      map.addLayer({
        id: casingLayerId,
        type: 'line',
        source: sourceId,
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': outlineColor,
          'line-width': outlineWidth + 4,
          'line-opacity': 0.3,
          'line-blur': 3,
        },
      });
    }

    if (!map.getLayer(outlineLayerId) && coordinates.length >= 2) {
      // Outline layer
      map.addLayer({
        id: outlineLayerId,
        type: 'line',
        source: sourceId,
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': outlineColor,
          'line-width': outlineWidth,
          'line-opacity': opacity,
        },
      });
    }

    if (!map.getLayer(mainLayerId) && coordinates.length >= 2) {
      // Main route layer
      map.addLayer({
        id: mainLayerId,
        type: 'line',
        source: sourceId,
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': color,
          'line-width': width,
          'line-opacity': opacity,
        },
      });
    }

    // Update paint properties for existing layers
    if (map.getLayer(mainLayerId)) {
      map.setPaintProperty(mainLayerId, 'line-color', color);
      map.setPaintProperty(mainLayerId, 'line-width', width);
      map.setPaintProperty(mainLayerId, 'line-opacity', opacity);
    }

    if (map.getLayer(outlineLayerId)) {
      map.setPaintProperty(outlineLayerId, 'line-color', outlineColor);
      map.setPaintProperty(outlineLayerId, 'line-width', outlineWidth);
    }

    // Handle calculating animation
    if (isCalculating && map.getLayer(mainLayerId)) {
      let phase = 0;

      const animate = () => {
        phase = (phase + 0.02) % 1;

        // Pulse opacity effect
        const pulseOpacity = 0.5 + Math.sin(phase * Math.PI * 2) * 0.3;
        map.setPaintProperty(mainLayerId, 'line-opacity', pulseOpacity);

        animationRef.current = requestAnimationFrame(animate);
      };

      animate();
    } else if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;

      // Reset opacity
      if (map.getLayer(mainLayerId)) {
        map.setPaintProperty(mainLayerId, 'line-opacity', opacity);
      }
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }

      // Clean up layers
      [mainLayerId, outlineLayerId, casingLayerId].forEach((layerId) => {
        if (map.getLayer(layerId)) {
          map.removeLayer(layerId);
        }
      });

      if (map.getSource(sourceId)) {
        map.removeSource(sourceId);
      }
    };
  }, [map, isLoaded, id, coordinates, isCalculating, color, outlineColor, width, outlineWidth, opacity]);

  return null;
}

/**
 * RecordedPathLayer - Shows raw GPS points during recording
 */
interface RecordedPathLayerProps {
  id: string;
  coordinates: [number, number][];
  color?: string;
  pointSize?: number;
}

export function RecordedPathLayer({
  id,
  coordinates,
  color = '#f59e0b', // Amber-500
  pointSize = 4,
}: RecordedPathLayerProps) {
  const { map, isLoaded } = useMap();

  useEffect(() => {
    if (!map || !isLoaded) return;

    const sourceId = `recorded-path-source-${id}`;
    const lineLayerId = `recorded-path-line-${id}`;
    const pointsLayerId = `recorded-path-points-${id}`;

    // Line data
    const lineData: GeoJSON.Feature = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: coordinates.length >= 2 ? coordinates : [],
      },
    };

    // Points data
    const pointsData: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: coordinates.map((coord, i) => ({
        type: 'Feature' as const,
        properties: { index: i },
        geometry: {
          type: 'Point' as const,
          coordinates: coord,
        },
      })),
    };

    // Add line source
    if (!map.getSource(sourceId)) {
      map.addSource(sourceId, {
        type: 'geojson',
        data: lineData,
      });
    } else {
      const source = map.getSource(sourceId) as mapboxgl.GeoJSONSource;
      source.setData(lineData);
    }

    // Add points source
    const pointsSourceId = `${sourceId}-points`;
    if (!map.getSource(pointsSourceId)) {
      map.addSource(pointsSourceId, {
        type: 'geojson',
        data: pointsData,
      });
    } else {
      const source = map.getSource(pointsSourceId) as mapboxgl.GeoJSONSource;
      source.setData(pointsData);
    }

    // Add line layer
    if (!map.getLayer(lineLayerId) && coordinates.length >= 2) {
      map.addLayer({
        id: lineLayerId,
        type: 'line',
        source: sourceId,
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': color,
          'line-width': 3,
          'line-opacity': 0.6,
          'line-dasharray': [2, 2],
        },
      });
    }

    // Add points layer
    if (!map.getLayer(pointsLayerId)) {
      map.addLayer({
        id: pointsLayerId,
        type: 'circle',
        source: pointsSourceId,
        paint: {
          'circle-radius': pointSize,
          'circle-color': color,
          'circle-opacity': 0.8,
          'circle-stroke-width': 1,
          'circle-stroke-color': '#ffffff',
        },
      });
    }

    return () => {
      [lineLayerId, pointsLayerId].forEach((layerId) => {
        if (map.getLayer(layerId)) {
          map.removeLayer(layerId);
        }
      });

      [sourceId, pointsSourceId].forEach((srcId) => {
        if (map.getSource(srcId)) {
          map.removeSource(srcId);
        }
      });
    };
  }, [map, isLoaded, id, coordinates, color, pointSize]);

  return null;
}
