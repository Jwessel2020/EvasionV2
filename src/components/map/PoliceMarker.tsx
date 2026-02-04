'use client';

import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import { useMap } from './MapProvider';
import type { PoliceAlert } from '@/types';
import { formatRelativeTime } from '@/lib/utils';

interface PoliceMarkerProps {
  alert: PoliceAlert;
  onClick?: (alert: PoliceAlert) => void;
}

const REPORT_TYPE_LABELS: Record<string, string> = {
  STATIONARY: 'Parked',
  MOBILE: 'Patrol',
  SPEED_TRAP: 'Speed Trap',
  CHECKPOINT: 'Checkpoint',
  ACCIDENT: 'Accident',
};

export function PoliceMarker({ alert, onClick }: PoliceMarkerProps) {
  const { map } = useMap();
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const onClickRef = useRef(onClick);

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/8ecbc98d-1e8e-44c9-8f10-253e23d24891',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PoliceMarker.tsx:render',message:'PoliceMarker RENDER',data:{alertId:alert.id,hasMarker:!!markerRef.current},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'T',runId:'post-fix-8'})}).catch(()=>{});
  // #endregion

  // Keep the callback ref up to date without triggering re-renders
  useEffect(() => {
    onClickRef.current = onClick;
  }, [onClick]);

  useEffect(() => {
    if (!map) return;

    // Create custom marker element
    const el = document.createElement('div');
    el.className = 'police-marker';
    el.innerHTML = `
      <div class="relative group cursor-pointer">
        <div class="w-9 h-9 rounded-full bg-red-600 border-2 border-red-300 flex items-center justify-center shadow-lg animate-pulse">
          <svg class="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
        </div>
        <div class="absolute -bottom-12 left-1/2 -translate-x-1/2 whitespace-nowrap bg-red-900/95 px-3 py-1.5 rounded text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity border border-red-500/50">
          <div class="font-semibold">${REPORT_TYPE_LABELS[alert.reportType] || alert.reportType}</div>
          <div class="text-red-300 text-[10px]">${formatRelativeTime(new Date(alert.reportedAt))} • ${alert.confirmations} confirms</div>
        </div>
      </div>
    `;

    el.addEventListener('click', () => {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/8ecbc98d-1e8e-44c9-8f10-253e23d24891',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PoliceMarker.tsx:click',message:'POLICE MARKER CLICKED',data:{alertId:alert.id},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'T',runId:'post-fix-8'})}).catch(()=>{});
      // #endregion
      onClickRef.current?.(alert);
    });

    const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
      .setLngLat([alert.location.longitude, alert.location.latitude])
      .addTo(map);

    markerRef.current = marker;

    return () => {
      marker.remove();
    };
  }, [map, alert.id, alert.reportType, alert.reportedAt, alert.confirmations, alert.location.longitude, alert.location.latitude]);

  return null;
}
