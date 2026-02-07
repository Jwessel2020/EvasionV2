'use client';

import { useEffect } from 'react';
import { useMap } from './MapProvider';

interface RouteLayerProps {
  id: string;
  coordinates: [number, number][]; // Array of [lng, lat]
  color?: string;
  width?: number;
  opacity?: number;
  dashed?: boolean;
}

export function RouteLayer({
  id,
  coordinates,
  color = '#a855f7', // Violet
  width = 4,
  opacity = 0.8,
  dashed = false,
}: RouteLayerProps) {
  const { map, isLoaded } = useMap();

  useEffect(() => {
    if (!map || !isLoaded || coordinates.length < 2) return;

    const sourceId = `route-source-${id}`;
    const layerId = `route-layer-${id}`;

    // Add source
    if (!map.getSource(sourceId)) {
      map.addSource(sourceId, {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates,
          },
        },
      });
    } else {
      // Update existing source
      const source = map.getSource(sourceId) as mapboxgl.GeoJSONSource;
      source.setData({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates,
        },
      });
    }

    // Add layer if it doesn't exist
    if (!map.getLayer(layerId)) {
      map.addLayer({
        id: layerId,
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
          ...(dashed && { 'line-dasharray': [2, 2] }),
        },
      });
    }

    return () => {
      if (map.getLayer(layerId)) {
        map.removeLayer(layerId);
      }
      if (map.getSource(sourceId)) {
        map.removeSource(sourceId);
      }
    };
  }, [map, isLoaded, id, coordinates, color, width, opacity, dashed]);

  return null;
}
