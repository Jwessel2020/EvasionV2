'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { MapProvider, BaseMap } from '@/components/map';
import { RoutePreviewLayer } from '@/components/map/RoutePreviewLayer';
import { WaypointMarkers } from '@/components/map/WaypointMarkers';
import { Button, Input, Card, CardContent } from '@/components/ui';
import { useRouteBuilderStore, type Waypoint } from '@/stores/route-builder-store';
import { formatDuration } from '@/lib/mapbox/routing';
import {
  ArrowLeft,
  Save,
  Trash2,
  Undo,
  GripVertical,
  X,
  Navigation,
  Clock,
  Route as RouteIcon,
  Loader2
} from 'lucide-react';
import Link from 'next/link';

interface RouteData {
  id: string;
  name: string;
  description: string | null;
  pathCoordinates: [number, number][];
  waypoints: { lng: number; lat: number; order: number }[] | null;
  distanceMiles: number;
  durationSeconds: number | null;
  estimatedTime: number | null;
  difficulty: string;
  tags: string[];
  isPublic: boolean;
}

export default function EditRoutePage() {
  const router = useRouter();
  const params = useParams();
  const routeId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [routeName, setRouteName] = useState('');
  const [routeDescription, setRouteDescription] = useState('');
  const [difficulty, setDifficulty] = useState('MODERATE');
  const [tags, setTags] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Route builder store
  const {
    mode,
    waypoints,
    selectedWaypointIndex,
    routeGeometry,
    routeDistance,
    routeDuration,
    isCalculating,
    error: builderError,
    setMode,
    addWaypoint,
    removeWaypoint,
    moveWaypoint,
    selectWaypoint,
    clearRoute,
    loadRoute,
  } = useRouteBuilderStore();

  // Fetch route data
  useEffect(() => {
    const fetchRoute = async () => {
      try {
        const response = await fetch(`/api/routes/${routeId}`);
        if (!response.ok) {
          throw new Error('Route not found');
        }

        const data: RouteData = await response.json();

        // Set form values
        setRouteName(data.name);
        setRouteDescription(data.description || '');
        setDifficulty(data.difficulty);
        setTags(data.tags.join(', '));
        setIsPublic(data.isPublic);

        // Load route into builder store
        if (data.waypoints && data.waypoints.length > 0) {
          // Use saved waypoints
          const waypointList: Waypoint[] = data.waypoints
            .sort((a, b) => a.order - b.order)
            .map((wp, i) => ({
              id: `wp_loaded_${i}`,
              lng: wp.lng,
              lat: wp.lat,
            }));

          loadRoute(
            waypointList,
            data.pathCoordinates,
            data.distanceMiles,
            data.durationSeconds || (data.estimatedTime ? data.estimatedTime * 60 : 0)
          );
        } else {
          // Use start/end of path as waypoints
          const coords = data.pathCoordinates;
          if (coords.length >= 2) {
            const waypointList: Waypoint[] = [
              { id: 'wp_start', lng: coords[0][0], lat: coords[0][1] },
              { id: 'wp_end', lng: coords[coords.length - 1][0], lat: coords[coords.length - 1][1] },
            ];

            loadRoute(
              waypointList,
              coords,
              data.distanceMiles,
              data.durationSeconds || (data.estimatedTime ? data.estimatedTime * 60 : 0)
            );
          }
        }

        setLoading(false);
      } catch (err) {
        console.error('Failed to fetch route:', err);
        setError('Failed to load route');
        setLoading(false);
      }
    };

    fetchRoute();

    return () => {
      // Clear route when leaving page
      clearRoute();
    };
  }, [routeId, loadRoute, clearRoute]);

  // Handle map click for adding waypoints
  const handleMapClick = useCallback((lng: number, lat: number) => {
    if (mode === 'editing') {
      addWaypoint(lng, lat);
    }
  }, [mode, addWaypoint]);

  // Handle save
  const handleSave = async () => {
    if (!routeGeometry || routeGeometry.length < 2 || !routeName) return;

    setIsSaving(true);

    const routeData = {
      name: routeName,
      description: routeDescription,
      pathCoordinates: routeGeometry,
      waypoints: waypoints.map((wp, i) => ({ lng: wp.lng, lat: wp.lat, order: i })),
      distanceMiles: Math.round(routeDistance * 10) / 10,
      durationSeconds: Math.round(routeDuration),
      difficulty,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      isPublic,
    };

    try {
      const response = await fetch(`/api/routes/${routeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(routeData),
      });

      if (response.ok) {
        router.push('/routes');
      } else {
        console.error('Failed to save route');
        setIsSaving(false);
      }
    } catch (err) {
      console.error('Error saving route:', err);
      setIsSaving(false);
    }
  };

  const canSave = routeGeometry && routeGeometry.length >= 2 && routeName.trim() !== '';

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-violet-500 mx-auto" />
          <p className="text-zinc-400">Loading route...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <p className="text-red-400">{error}</p>
          <Link href="/routes">
            <Button variant="secondary">Back to Routes</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex gap-6">
      {/* Map */}
      <div className="flex-1 relative">
        <MapProvider>
          <BaseMap
            initialCenter={routeGeometry && routeGeometry.length > 0 ? routeGeometry[0] : [-118.2437, 34.0522]}
            initialZoom={12}
            className="w-full h-full rounded-xl overflow-hidden border border-zinc-800"
            onClick={handleMapClick}
          >
            {/* Route layer */}
            {routeGeometry && routeGeometry.length >= 2 && (
              <RoutePreviewLayer
                id="edit-route"
                coordinates={routeGeometry}
                isCalculating={isCalculating}
              />
            )}

            {/* Waypoint markers */}
            {waypoints.length > 0 && (
              <WaypointMarkers
                waypoints={waypoints}
                selectedIndex={selectedWaypointIndex}
                onWaypointDrag={moveWaypoint}
                onWaypointClick={selectWaypoint}
                draggable={mode === 'editing'}
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

          {/* Edit mode toggle */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 flex bg-zinc-900/90 backdrop-blur-sm rounded-lg border border-zinc-700 p-1">
            <button
              onClick={() => setMode(mode === 'editing' ? 'idle' : 'editing')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                mode === 'editing'
                  ? 'bg-violet-500 text-white'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Navigation size={16} />
              {mode === 'editing' ? 'Click to Add Points' : 'View Mode'}
            </button>
          </div>

          {/* Edit controls */}
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

          {/* Instructions */}
          {mode === 'editing' && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-zinc-900/95 backdrop-blur-sm px-6 py-3 rounded-xl border border-zinc-800 shadow-lg">
              <div className="flex items-center gap-3 text-sm">
                <Navigation size={18} className="text-violet-500" />
                <span className="text-zinc-300">Click to add waypoints, drag to move. Route snaps to roads.</span>
              </div>
            </div>
          )}

          {/* Error display */}
          {builderError && (
            <div className="absolute bottom-6 left-6 bg-red-900/90 backdrop-blur-sm px-4 py-2 rounded-lg border border-red-700">
              <p className="text-sm text-red-200">{builderError}</p>
            </div>
          )}
        </MapProvider>
      </div>

      {/* Sidebar form */}
      <div className="w-80 flex-shrink-0">
        <Card className="h-full overflow-y-auto">
          <CardContent className="p-6 space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white mb-1">Edit Route</h2>
              <p className="text-sm text-zinc-400">Modify your route</p>
            </div>

            {/* Waypoints list */}
            {waypoints.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-zinc-300">Waypoints</h3>
                <div className="space-y-1 max-h-48 overflow-y-auto">
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
            {routeGeometry && routeGeometry.length >= 2 && (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-zinc-800/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-xs text-zinc-400 mb-1">
                    <RouteIcon size={12} />
                    Distance
                  </div>
                  <p className="text-lg font-bold text-white">
                    {routeDistance.toFixed(1)} mi
                  </p>
                </div>
                <div className="bg-zinc-800/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-xs text-zinc-400 mb-1">
                    <Clock size={12} />
                    Duration
                  </div>
                  <p className="text-lg font-bold text-white">
                    {formatDuration(routeDuration)}
                  </p>
                </div>
              </div>
            )}

            {/* Loading indicator */}
            {isCalculating && (
              <div className="flex items-center gap-2 text-sm text-violet-400">
                <div className="w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                Recalculating route...
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

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="isPublic"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className="w-4 h-4 bg-zinc-800 border-zinc-600 rounded focus:ring-violet-500 focus:ring-2"
                />
                <label htmlFor="isPublic" className="text-sm text-zinc-300">
                  Make this route public
                </label>
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-800 space-y-3">
              <Button
                className="w-full"
                onClick={handleSave}
                isLoading={isSaving}
                disabled={!canSave || isSaving || isCalculating}
              >
                <Save size={16} className="mr-2" />
                Save Changes
              </Button>
              <p className="text-xs text-zinc-500 text-center">
                {!routeGeometry || routeGeometry.length < 2
                  ? 'Route must have at least 2 points'
                  : !routeName.trim()
                    ? 'Enter a route name to save'
                    : 'Changes will be saved immediately'
                }
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
