'use client';

import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import { useMap } from './MapProvider';
import { Pause, Play, Square, Navigation } from 'lucide-react';
import { formatDuration } from '@/lib/mapbox/routing';
import type { GPSPoint, RecordingState } from '@/stores/route-recorder-store';

interface RecordingOverlayProps {
  state: RecordingState;
  currentPosition: GPSPoint | null;
  distance: number;
  duration: number;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}

export function RecordingOverlay({
  state,
  currentPosition,
  distance,
  duration,
  onPause,
  onResume,
  onStop,
}: RecordingOverlayProps) {
  const { map, isLoaded } = useMap();
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const pulseRef = useRef<number | null>(null);

  // Current position marker
  useEffect(() => {
    if (!map || !isLoaded || !currentPosition) return;

    // Remove existing marker
    if (markerRef.current) {
      markerRef.current.remove();
    }

    // Create pulsing marker element
    const el = document.createElement('div');
    el.className = 'current-position-marker';
    el.innerHTML = `
      <div class="relative">
        <div class="absolute inset-0 w-8 h-8 bg-blue-500 rounded-full animate-ping opacity-25"></div>
        <div class="relative w-8 h-8 bg-blue-500 rounded-full border-3 border-white shadow-lg flex items-center justify-center">
          <div class="w-3 h-3 bg-white rounded-full"></div>
        </div>
        ${currentPosition.heading !== undefined ? `
          <div class="absolute -top-1 left-1/2 -translate-x-1/2 -translate-y-full">
            <svg class="w-4 h-4 text-blue-500" style="transform: rotate(${currentPosition.heading}deg)" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L8 10h8L12 2z"/>
            </svg>
          </div>
        ` : ''}
      </div>
    `;

    const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
      .setLngLat([currentPosition.lng, currentPosition.lat])
      .addTo(map);

    markerRef.current = marker;

    // Center map on current position
    map.panTo([currentPosition.lng, currentPosition.lat], { duration: 500 });

    return () => {
      marker.remove();
    };
  }, [map, isLoaded, currentPosition]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (markerRef.current) {
        markerRef.current.remove();
      }
      if (pulseRef.current) {
        cancelAnimationFrame(pulseRef.current);
      }
    };
  }, []);

  if (state !== 'recording' && state !== 'paused') {
    return null;
  }

  const isRecording = state === 'recording';
  const isPaused = state === 'paused';

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20">
      <div className="bg-zinc-900/95 backdrop-blur-md rounded-2xl border border-zinc-700 shadow-2xl p-4 min-w-[320px]">
        {/* Recording indicator */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-yellow-500'}`} />
            <span className="text-white font-medium">
              {isRecording ? 'Recording...' : 'Paused'}
            </span>
          </div>
          {currentPosition?.accuracy && (
            <div className="flex items-center gap-1 text-xs text-zinc-400">
              <Navigation className="w-3 h-3" />
              <span>{Math.round(currentPosition.accuracy)}m accuracy</span>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-zinc-800/50 rounded-lg p-3">
            <div className="text-xs text-zinc-400 mb-1">Distance</div>
            <div className="text-xl font-bold text-white">
              {distance.toFixed(2)} <span className="text-sm font-normal text-zinc-400">mi</span>
            </div>
          </div>
          <div className="bg-zinc-800/50 rounded-lg p-3">
            <div className="text-xs text-zinc-400 mb-1">Duration</div>
            <div className="text-xl font-bold text-white">
              {formatDuration(duration)}
            </div>
          </div>
        </div>

        {/* Speed indicator */}
        {currentPosition?.speed !== undefined && currentPosition.speed > 0 && (
          <div className="bg-zinc-800/50 rounded-lg p-3 mb-4">
            <div className="text-xs text-zinc-400 mb-1">Current Speed</div>
            <div className="text-xl font-bold text-white">
              {Math.round(currentPosition.speed * 2.237)} <span className="text-sm font-normal text-zinc-400">mph</span>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center justify-center gap-4">
          {isRecording ? (
            <button
              onClick={onPause}
              className="flex items-center gap-2 px-6 py-3 bg-yellow-500 hover:bg-yellow-400 text-black font-medium rounded-xl transition-colors"
            >
              <Pause className="w-5 h-5" />
              Pause
            </button>
          ) : (
            <button
              onClick={onResume}
              className="flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-white font-medium rounded-xl transition-colors"
            >
              <Play className="w-5 h-5" />
              Resume
            </button>
          )}

          <button
            onClick={onStop}
            className="flex items-center gap-2 px-6 py-3 bg-red-500 hover:bg-red-400 text-white font-medium rounded-xl transition-colors"
          >
            <Square className="w-5 h-5" />
            Stop
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * ProcessingOverlay - Shows while route is being matched to roads
 */
interface ProcessingOverlayProps {
  message?: string;
}

export function ProcessingOverlay({ message = 'Processing route...' }: ProcessingOverlayProps) {
  return (
    <div className="absolute inset-0 z-30 bg-black/50 backdrop-blur-sm flex items-center justify-center">
      <div className="bg-zinc-900 rounded-2xl border border-zinc-700 shadow-2xl p-8 text-center">
        <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-white font-medium">{message}</p>
        <p className="text-zinc-400 text-sm mt-2">Matching your route to roads...</p>
      </div>
    </div>
  );
}

/**
 * RoutePreviewOverlay - Shows matched route for review
 */
interface RoutePreviewOverlayProps {
  distance: number;
  duration: number;
  confidence: number | null;
  onAccept: () => void;
  onDiscard: () => void;
}

export function RoutePreviewOverlay({
  distance,
  duration,
  confidence,
  onAccept,
  onDiscard,
}: RoutePreviewOverlayProps) {
  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20">
      <div className="bg-zinc-900/95 backdrop-blur-md rounded-2xl border border-zinc-700 shadow-2xl p-4 min-w-[320px]">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <Navigation className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <h3 className="text-white font-medium">Route Ready</h3>
            <p className="text-xs text-zinc-400">Review your recorded route</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
            <div className="text-xs text-zinc-400 mb-1">Distance</div>
            <div className="text-lg font-bold text-white">
              {distance.toFixed(1)} mi
            </div>
          </div>
          <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
            <div className="text-xs text-zinc-400 mb-1">Duration</div>
            <div className="text-lg font-bold text-white">
              {formatDuration(duration)}
            </div>
          </div>
          <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
            <div className="text-xs text-zinc-400 mb-1">Match</div>
            <div className={`text-lg font-bold ${
              confidence && confidence > 0.8 ? 'text-emerald-400' :
              confidence && confidence > 0.5 ? 'text-yellow-400' :
              'text-red-400'
            }`}>
              {confidence ? `${Math.round(confidence * 100)}%` : 'N/A'}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={onDiscard}
            className="flex-1 px-4 py-3 bg-zinc-700 hover:bg-zinc-600 text-white font-medium rounded-xl transition-colors"
          >
            Discard
          </button>
          <button
            onClick={onAccept}
            className="flex-1 px-4 py-3 bg-emerald-500 hover:bg-emerald-400 text-white font-medium rounded-xl transition-colors"
          >
            Use This Route
          </button>
        </div>
      </div>
    </div>
  );
}
