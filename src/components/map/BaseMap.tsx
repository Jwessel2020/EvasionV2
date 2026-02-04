'use client';

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import { useMap } from './MapProvider';

// Set Mapbox token
mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

interface BaseMapProps {
  initialCenter?: [number, number]; // [lng, lat]
  initialZoom?: number;
  className?: string;
  onMove?: (center: { lng: number; lat: number }, zoom: number) => void;
  onClick?: (lng: number, lat: number) => void;
  children?: React.ReactNode;
}

export function BaseMap({
  initialCenter = [-98.5795, 39.8283], // Center of USA
  initialZoom = 4,
  className = '',
  onMove,
  onClick,
  children,
}: BaseMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const { setMap } = useMap();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/8ecbc98d-1e8e-44c9-8f10-253e23d24891',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'BaseMap.tsx:useEffect',message:'BaseMap effect triggered',data:{hasContainer:!!mapContainer.current,hasMapRef:!!mapRef.current,initialCenter,initialZoom},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A',runId:'post-fix'})}).catch(()=>{});
    // #endregion
    if (!mapContainer.current || mapRef.current) return;

    // Check if token exists
    if (!mapboxgl.accessToken) {
      console.warn('Mapbox token not configured. Add NEXT_PUBLIC_MAPBOX_TOKEN to .env.local');
      return;
    }

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11', // Dark theme to match Evasion
      center: initialCenter,
      zoom: initialZoom,
      pitch: 0,
      bearing: 0,
      attributionControl: false,
    });

    // Add navigation controls
    map.addControl(
      new mapboxgl.NavigationControl({ showCompass: true }),
      'top-right'
    );

    // Add geolocation control
    map.addControl(
      new mapboxgl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
        showUserHeading: true,
      }),
      'top-right'
    );

    // Add scale
    map.addControl(
      new mapboxgl.ScaleControl({ maxWidth: 100 }),
      'bottom-left'
    );

    map.on('load', () => {
      mapRef.current = map;
      setMap(map);
      setIsReady(true);
    });

    map.on('move', () => {
      if (onMove) {
        const center = map.getCenter();
        onMove({ lng: center.lng, lat: center.lat }, map.getZoom());
      }
    });

    map.on('click', (e) => {
      if (onClick) {
        onClick(e.lngLat.lng, e.lngLat.lat);
      }
    });

    return () => {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/8ecbc98d-1e8e-44c9-8f10-253e23d24891',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'BaseMap.tsx:cleanup',message:'BaseMap CLEANUP - destroying map',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A',runId:'post-fix'})}).catch(()=>{});
      // #endregion
      setMap(null);
      map.remove();
      mapRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setMap]); // Only depend on setMap - initialCenter/initialZoom are for initial render only

  return (
    <div className={`relative ${className}`} style={{ minHeight: '400px' }}>
      <div ref={mapContainer} className="absolute inset-0 w-full h-full" />
      {!mapboxgl.accessToken && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/90 z-10">
          <div className="text-center p-6 max-w-md">
            <div className="w-16 h-16 rounded-full bg-orange-500/20 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Map Not Configured</h3>
            <p className="text-zinc-400 text-sm">
              Add your Mapbox token to <code className="text-orange-400">.env.local</code>:
              <br />
              <code className="text-xs">NEXT_PUBLIC_MAPBOX_TOKEN=pk.your_token</code>
            </p>
          </div>
        </div>
      )}
      {isReady && children}
    </div>
  );
}
