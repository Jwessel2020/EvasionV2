'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MapProvider, BaseMap } from '@/components/map';
import { RoutePreviewLayer, RecordedPathLayer } from '@/components/map/RoutePreviewLayer';
import { WaypointMarkers } from '@/components/map/WaypointMarkers';
import { RecordingOverlay, ProcessingOverlay, RoutePreviewOverlay } from '@/components/map/RecordingOverlay';
import { Button, Input, Card, CardContent } from '@/components/ui';
import { useRouteBuilderStore } from '@/stores/route-builder-store';
import { useRouteRecorderStore } from '@/stores/route-recorder-store';
import { formatDuration } from '@/lib/mapbox/routing';
import {
  ArrowLeft,
  Save,
  Trash2,
  Undo,
  Pencil,
  Radio,
  GripVertical,
  X,
  Navigation,
  Clock,
  Route as RouteIcon
} from 'lucide-react';
import Link from 'next/link';

type CreationMode = 'draw' | 'record';

export default function CreateRoutePage() {
  const router = useRouter();
  const [creationMode, setCreationMode] = useState<CreationMode>('draw');
  const [routeName, setRouteName] = useState('');
  const [routeDescription, setRouteDescription] = useState('');
  const [difficulty, setDifficulty] = useState('MODERATE');
  const [tags, setTags] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Route builder store (for draw mode)
  const {
    mode: builderMode,
    waypoints,
    selectedWaypointIndex,
    routeGeometry,
    routeDistance,
    routeDuration,
    isCalculating,
    error: builderError,
    setMode: setBuilderMode,
    addWaypoint,
    removeWaypoint,
    moveWaypoint,
    selectWaypoint,
    clearRoute,
  } = useRouteBuilderStore();

  // Route recorder store (for record mode)
  const {
    state: recordingState,
    rawPoints,
    matchedRoute,
    distance: recordedDistance,
    duration: recordedDuration,
    currentPosition,
    matchConfidence,
    error: recorderError,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    addPoint,
    discardRoute,
    acceptRoute,
  } = useRouteRecorderStore();

  // GPS tracking for record mode
  useEffect(() => {
    if (creationMode !== 'record') return;
    if (recordingState !== 'recording') return;

    let watchId: number | null = null;

    if ('geolocation' in navigator) {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          addPoint({
            lng: position.coords.longitude,
            lat: position.coords.latitude,
            timestamp: Date.now(),
            accuracy: position.coords.accuracy,
            speed: position.coords.speed ?? undefined,
            heading: position.coords.heading ?? undefined,
          });
        },
        (error) => {
          console.error('GPS error:', error);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 1000,
          timeout: 5000,
        }
      );
    }

    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [creationMode, recordingState, addPoint]);

  // Initialize draw mode
  useEffect(() => {
    if (creationMode === 'draw') {
      setBuilderMode('drawing');
    } else {
      setBuilderMode('idle');
    }
  }, [creationMode, setBuilderMode]);

  // Handle map click for draw mode
  const handleMapClick = useCallback((lng: number, lat: number) => {
    if (creationMode === 'draw') {
      addWaypoint(lng, lat);
    }
  }, [creationMode, addWaypoint]);

  // Handle accepting recorded route
  const handleAcceptRecordedRoute = () => {
    const result = acceptRoute();
    if (result) {
      // Switch to draw mode with the recorded route
      setCreationMode('draw');
      // The recorded route coordinates can be used to populate waypoints
      // For simplicity, we'll use start and end points as waypoints
      if (result.coordinates.length >= 2) {
        const start = result.coordinates[0];
        const end = result.coordinates[result.coordinates.length - 1];
        clearRoute();
        addWaypoint(start[0], start[1]);
        addWaypoint(end[0], end[1]);
      }
    }
  };

  // Handle save
  const handleSave = async () => {
    const finalGeometry = creationMode === 'draw' ? routeGeometry : matchedRoute;
    const finalDistance = creationMode === 'draw' ? routeDistance : recordedDistance;
    const finalDuration = creationMode === 'draw' ? routeDuration : recordedDuration;

    if (!finalGeometry || finalGeometry.length < 2 || !routeName) return;

    setIsSaving(true);

    const routeData = {
      name: routeName,
      description: routeDescription,
      pathCoordinates: finalGeometry,
      waypoints: waypoints.map((wp, i) => ({ lng: wp.lng, lat: wp.lat, order: i })),
      distanceMiles: Math.round(finalDistance * 10) / 10,
      durationSeconds: Math.round(finalDuration),
      difficulty,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      creationMethod: creationMode === 'draw' ? 'manual' : 'recorded',
      isPublic: true,
    };

    try {
      const response = await fetch('/api/routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(routeData),
      });

      if (response.ok) {
        router.push('/routes');
      } else {
        const errorData = await response.json().catch(() => null);
        console.error('Failed to save route:', response.status, errorData);
        setIsSaving(false);
      }
    } catch (err) {
      console.error('Error saving route:', err);
      setIsSaving(false);
    }
  };

  // Current values based on mode
  const currentDistance = creationMode === 'draw' ? routeDistance : recordedDistance;
  const currentDuration = creationMode === 'draw' ? routeDuration : recordedDuration;
  const currentGeometry = creationMode === 'draw' ? routeGeometry : matchedRoute;
  const canSave = currentGeometry && currentGeometry.length >= 2 && routeName.trim() !== '';

  return (
    <div className="h-[calc(100vh-8rem)] flex gap-6">
      {/* Map */}
      <div className="flex-1 relative">
        <MapProvider>
          <BaseMap
            initialCenter={[-118.2437, 34.0522]}
            initialZoom={11}
            className="w-full h-full rounded-xl overflow-hidden border border-zinc-800"
            onClick={handleMapClick}
          >
            {/* Draw mode layers */}
            {creationMode === 'draw' && routeGeometry && routeGeometry.length >= 2 && (
              <RoutePreviewLayer
                id="draw-route"
                coordinates={routeGeometry}
                isCalculating={isCalculating}
              />
            )}
            {creationMode === 'draw' && waypoints.length > 0 && (
              <WaypointMarkers
                waypoints={waypoints}
                selectedIndex={selectedWaypointIndex}
                onWaypointDrag={moveWaypoint}
                onWaypointClick={selectWaypoint}
                draggable={builderMode === 'drawing' || builderMode === 'editing'}
              />
            )}

            {/* Record mode layers */}
            {creationMode === 'record' && rawPoints.length >= 2 && recordingState !== 'preview' && (
              <RecordedPathLayer
                id="recording-path"
                coordinates={rawPoints.map(p => [p.lng, p.lat] as [number, number])}
              />
            )}
            {creationMode === 'record' && matchedRoute && recordingState === 'preview' && (
              <RoutePreviewLayer
                id="matched-route"
                coordinates={matchedRoute}
                color="#10b981"
              />
            )}

            {/* Recording overlay */}
            {creationMode === 'record' && (recordingState === 'recording' || recordingState === 'paused') && (
              <RecordingOverlay
                state={recordingState}
                currentPosition={currentPosition}
                distance={recordedDistance}
                duration={recordedDuration}
                onPause={pauseRecording}
                onResume={resumeRecording}
                onStop={stopRecording}
              />
            )}

            {/* Processing overlay */}
            {creationMode === 'record' && recordingState === 'processing' && (
              <ProcessingOverlay />
            )}

            {/* Preview overlay */}
            {creationMode === 'record' && recordingState === 'preview' && (
              <RoutePreviewOverlay
                distance={recordedDistance}
                duration={recordedDuration}
                confidence={matchConfidence}
                onAccept={handleAcceptRecordedRoute}
                onDiscard={discardRoute}
              />
            )}
          </BaseMap>

          {/* Top controls */}
          <div className="absolute top-4 left-4 flex gap-2">
            <Link href="/routes">
              <Button variant="secondary" size="sm">
                <ArrowLeft size={16} className="mr-1" />
                Back
              </Button>
            </Link>
          </div>

          {/* Mode toggle */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 flex bg-zinc-900/90 backdrop-blur-sm rounded-lg border border-zinc-700 p-1">
            <button
              onClick={() => setCreationMode('draw')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                creationMode === 'draw'
                  ? 'bg-violet-500 text-white'
                  : 'text-zinc-400 hover:text-white'
              }`}
              disabled={recordingState === 'recording' || recordingState === 'paused'}
            >
              <Pencil size={16} />
              Draw
            </button>
            <button
              onClick={() => setCreationMode('record')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                creationMode === 'record'
                  ? 'bg-violet-500 text-white'
                  : 'text-zinc-400 hover:text-white'
              }`}
              disabled={builderMode === 'drawing' && waypoints.length > 0}
            >
              <Radio size={16} />
              Record
            </button>
          </div>

          {/* Draw mode controls */}
          {creationMode === 'draw' && (
            <div className="absolute top-4 right-4 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (waypoints.length > 0) {
                    removeWaypoint(waypoints.length - 1);
                  }
                }}
                disabled={waypoints.length === 0 || isCalculating}
              >
                <Undo size={16} />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={clearRoute}
                disabled={waypoints.length === 0 || isCalculating}
              >
                <Trash2 size={16} />
              </Button>
            </div>
          )}

          {/* Record mode start button */}
          {creationMode === 'record' && recordingState === 'idle' && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
              <Button
                onClick={startRecording}
                className="bg-red-500 hover:bg-red-400 text-white px-8 py-3 text-lg"
              >
                <Radio size={20} className="mr-2" />
                Start Recording
              </Button>
            </div>
          )}

          {/* Draw mode instructions */}
          {creationMode === 'draw' && waypoints.length === 0 && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-zinc-900/95 backdrop-blur-sm px-6 py-3 rounded-xl border border-zinc-800 shadow-lg">
              <div className="flex items-center gap-3 text-sm">
                <Navigation size={18} className="text-violet-500" />
                <span className="text-zinc-300">Click on the map to add waypoints. Routes will snap to roads automatically.</span>
              </div>
            </div>
          )}

          {/* Error display */}
          {(builderError || recorderError) && (
            <div className="absolute bottom-6 left-6 bg-red-900/90 backdrop-blur-sm px-4 py-2 rounded-lg border border-red-700">
              <p className="text-sm text-red-200">{builderError || recorderError}</p>
            </div>
          )}
        </MapProvider>
      </div>

      {/* Sidebar form */}
      <div className="w-80 flex-shrink-0">
        <Card className="h-full overflow-y-auto">
          <CardContent className="p-6 space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white mb-1">Create Route</h2>
              <p className="text-sm text-zinc-400">
                {creationMode === 'draw'
                  ? 'Click the map to add waypoints'
                  : 'Record your drive with GPS'}
              </p>
            </div>

            {/* Waypoints list (draw mode) */}
            {creationMode === 'draw' && waypoints.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-zinc-300">Waypoints</h3>
                <div className="space-y-1">
                  {waypoints.map((wp, index) => (
                    <div
                      key={wp.id}
                      className={`flex items-center gap-2 p-2 rounded-lg transition-colors ${
                        selectedWaypointIndex === index
                          ? 'bg-violet-500/20 border border-violet-500/50'
                          : 'bg-zinc-800/50 hover:bg-zinc-800'
                      }`}
                      onClick={() => selectWaypoint(index)}
                    >
                      <GripVertical size={14} className="text-zinc-500 cursor-grab" />
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        index === 0 ? 'bg-emerald-500' :
                        index === waypoints.length - 1 ? 'bg-red-500' :
                        'bg-violet-500'
                      }`}>
                        {index + 1}
                      </div>
                      <span className="flex-1 text-sm text-zinc-300 truncate">
                        {index === 0 ? 'Start' : index === waypoints.length - 1 ? 'End' : `Via ${index}`}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeWaypoint(index);
                        }}
                        className="p-1 hover:bg-zinc-700 rounded"
                      >
                        <X size={14} className="text-zinc-400" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Route stats */}
            {currentGeometry && currentGeometry.length >= 2 && (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-zinc-800/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-xs text-zinc-400 mb-1">
                    <RouteIcon size={12} />
                    Distance
                  </div>
                  <p className="text-lg font-bold text-white">
                    {currentDistance.toFixed(1)} mi
                  </p>
                </div>
                <div className="bg-zinc-800/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-xs text-zinc-400 mb-1">
                    <Clock size={12} />
                    Duration
                  </div>
                  <p className="text-lg font-bold text-white">
                    {formatDuration(currentDuration)}
                  </p>
                </div>
              </div>
            )}

            {/* Loading indicator */}
            {isCalculating && (
              <div className="flex items-center gap-2 text-sm text-violet-400">
                <div className="w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                Calculating route...
              </div>
            )}

            <div className="space-y-4">
              <Input
                label="Route Name"
                placeholder="e.g., Canyon Run"
                value={routeName}
                onChange={(e) => setRouteName(e.target.value)}
              />

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                  Description
                </label>
                <textarea
                  placeholder="Describe the route, highlights, things to watch out for..."
                  value={routeDescription}
                  onChange={(e) => setRouteDescription(e.target.value)}
                  className="w-full px-4 py-2.5 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 resize-none h-24 focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                  Difficulty
                </label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  className="w-full px-4 py-2.5 bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  <option value="EASY">Easy - Relaxed driving</option>
                  <option value="MODERATE">Moderate - Some turns</option>
                  <option value="CHALLENGING">Challenging - Technical</option>
                  <option value="EXPERT">Expert - Advanced only</option>
                </select>
              </div>

              <Input
                label="Tags"
                placeholder="canyon, scenic, night (comma separated)"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                hint="Help others find your route"
              />
            </div>

            <div className="pt-4 border-t border-zinc-800 space-y-3">
              <Button
                className="w-full"
                onClick={handleSave}
                isLoading={isSaving}
                disabled={!canSave || isSaving || isCalculating}
              >
                <Save size={16} className="mr-2" />
                Save Route
              </Button>
              <p className="text-xs text-zinc-500 text-center">
                {!currentGeometry || currentGeometry.length < 2
                  ? 'Add at least 2 waypoints to save'
                  : !routeName.trim()
                    ? 'Enter a route name to save'
                    : 'Route will be public by default'
                }
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
