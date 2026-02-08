'use client';

import { useEffect, useRef, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import { useMap } from './MapProvider';
import type { Waypoint } from '@/stores/route-builder-store';

interface WaypointMarkersProps {
  waypoints: Waypoint[];
  selectedIndex: number | null;
  onWaypointDrag: (index: number, lng: number, lat: number) => void;
  onWaypointClick: (index: number) => void;
  draggable?: boolean;
}

export function WaypointMarkers({
  waypoints,
  selectedIndex,
  onWaypointDrag,
  onWaypointClick,
  draggable = true,
}: WaypointMarkersProps) {
  const { map, isLoaded } = useMap();
  const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());

  // Store callbacks in refs to avoid re-creating markers
  const onDragRef = useRef(onWaypointDrag);
  const onClickRef = useRef(onWaypointClick);

  useEffect(() => {
    onDragRef.current = onWaypointDrag;
    onClickRef.current = onWaypointClick;
  }, [onWaypointDrag, onWaypointClick]);

  // Create or update markers
  useEffect(() => {
    if (!map || !isLoaded) return;

    const currentMarkerIds = new Set(waypoints.map((wp) => wp.id));

    // Remove markers that are no longer in waypoints
    markersRef.current.forEach((marker, id) => {
      if (!currentMarkerIds.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    });

    // Create or update markers
    waypoints.forEach((waypoint, index) => {
      let marker = markersRef.current.get(waypoint.id);

      if (!marker) {
        // Create marker element
        const el = createMarkerElement(index, waypoints.length, selectedIndex === index);

        marker = new mapboxgl.Marker({
          element: el,
          anchor: 'center',
          draggable,
        })
          .setLngLat([waypoint.lng, waypoint.lat])
          .addTo(map);

        // Handle drag events
        if (draggable) {
          marker.on('dragend', () => {
            const lngLat = marker!.getLngLat();
            // Find current index of this waypoint
            const currentIndex = waypoints.findIndex((wp) => wp.id === waypoint.id);
            if (currentIndex !== -1) {
              onDragRef.current(currentIndex, lngLat.lng, lngLat.lat);
            }
          });
        }

        // Handle click
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          const currentIndex = waypoints.findIndex((wp) => wp.id === waypoint.id);
          if (currentIndex !== -1) {
            onClickRef.current(currentIndex);
          }
        });

        markersRef.current.set(waypoint.id, marker);
      } else {
        // Update existing marker position
        marker.setLngLat([waypoint.lng, waypoint.lat]);

        // Update marker element for selection/index changes
        const el = marker.getElement();
        updateMarkerElement(el, index, waypoints.length, selectedIndex === index);
      }
    });

    return () => {
      // Clean up all markers on unmount
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current.clear();
    };
  }, [map, isLoaded, waypoints, selectedIndex, draggable]);

  return null;
}

/**
 * Create a marker DOM element
 */
function createMarkerElement(index: number, total: number, isSelected: boolean): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'waypoint-marker';
  updateMarkerElement(el, index, total, isSelected);
  return el;
}

/**
 * Update marker element appearance based on position and selection
 */
function updateMarkerElement(
  el: HTMLElement,
  index: number,
  total: number,
  isSelected: boolean
): void {
  const isStart = index === 0;
  const isEnd = index === total - 1 && total > 1;

  // Colors based on position
  let bgColor = 'bg-violet-500'; // Default waypoint
  let borderColor = 'border-violet-300';
  let ringColor = 'ring-violet-500/30';

  if (isStart) {
    bgColor = 'bg-emerald-500';
    borderColor = 'border-emerald-300';
    ringColor = 'ring-emerald-500/30';
  } else if (isEnd) {
    bgColor = 'bg-red-500';
    borderColor = 'border-red-300';
    ringColor = 'ring-red-500/30';
  }

  // Selection ring
  const selectedRing = isSelected ? `ring-4 ${ringColor}` : '';

  // Number label
  const label = index + 1;

  el.innerHTML = `
    <div class="relative cursor-pointer transition-transform hover:scale-110 ${isSelected ? 'scale-110' : ''}">
      <div class="w-8 h-8 rounded-full ${bgColor} border-2 ${borderColor} ${selectedRing} flex items-center justify-center shadow-lg">
        <span class="text-white text-sm font-bold">${label}</span>
      </div>
      ${isStart ? `
        <div class="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] font-medium text-emerald-400 whitespace-nowrap">
          Start
        </div>
      ` : ''}
      ${isEnd ? `
        <div class="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] font-medium text-red-400 whitespace-nowrap">
          End
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * WaypointMarker - Single waypoint marker (for when you need individual control)
 */
interface SingleWaypointMarkerProps {
  lng: number;
  lat: number;
  index: number;
  total: number;
  isSelected?: boolean;
  draggable?: boolean;
  onDrag?: (lng: number, lat: number) => void;
  onClick?: () => void;
}

export function WaypointMarker({
  lng,
  lat,
  index,
  total,
  isSelected = false,
  draggable = true,
  onDrag,
  onClick,
}: SingleWaypointMarkerProps) {
  const { map, isLoaded } = useMap();
  const markerRef = useRef<mapboxgl.Marker | null>(null);

  useEffect(() => {
    if (!map || !isLoaded) return;

    const el = createMarkerElement(index, total, isSelected);

    const marker = new mapboxgl.Marker({
      element: el,
      anchor: 'center',
      draggable,
    })
      .setLngLat([lng, lat])
      .addTo(map);

    if (draggable && onDrag) {
      marker.on('dragend', () => {
        const lngLat = marker.getLngLat();
        onDrag(lngLat.lng, lngLat.lat);
      });
    }

    if (onClick) {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        onClick();
      });
    }

    markerRef.current = marker;

    return () => {
      marker.remove();
    };
  }, [map, isLoaded, lng, lat, index, total, isSelected, draggable, onDrag, onClick]);

  return null;
}
