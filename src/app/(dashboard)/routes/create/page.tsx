'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { MapProvider, BaseMap, RouteLayer } from '@/components/map';
import { Button, Input, Card, CardContent } from '@/components/ui';
import { useMap } from '@/components/map';
import { 
  ArrowLeft, 
  Save, 
  Trash2, 
  Undo, 
  MapPin,
  Route as RouteIcon,
  Info
} from 'lucide-react';
import Link from 'next/link';

export default function CreateRoutePage() {
  const router = useRouter();
  const [routePoints, setRoutePoints] = useState<[number, number][]>([]);
  const [routeName, setRouteName] = useState('');
  const [routeDescription, setRouteDescription] = useState('');
  const [difficulty, setDifficulty] = useState('MODERATE');
  const [tags, setTags] = useState('');
  const [isDrawing, setIsDrawing] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const handleMapClick = useCallback((lng: number, lat: number) => {
    if (!isDrawing) return;
    setRoutePoints((prev) => [...prev, [lng, lat]]);
  }, [isDrawing]);

  const handleUndo = () => {
    setRoutePoints((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setRoutePoints([]);
  };

  const handleSave = async () => {
    if (routePoints.length < 2 || !routeName) return;

    setIsSaving(true);
    
    // Calculate approximate distance (simplified)
    let distance = 0;
    for (let i = 1; i < routePoints.length; i++) {
      const [lng1, lat1] = routePoints[i - 1];
      const [lng2, lat2] = routePoints[i];
      distance += Math.sqrt(Math.pow(lng2 - lng1, 2) + Math.pow(lat2 - lat1, 2)) * 69; // Rough miles
    }

    const routeData = {
      name: routeName,
      description: routeDescription,
      pathCoordinates: routePoints,
      distanceMiles: Math.round(distance * 10) / 10,
      difficulty,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      isPublic: true,
    };

    console.log('Saving route:', routeData);
    
    // TODO: Save via API
    // await fetch('/api/routes', { method: 'POST', body: JSON.stringify(routeData) });

    setTimeout(() => {
      setIsSaving(false);
      router.push('/routes');
    }, 1000);
  };

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
            {routePoints.length >= 2 && (
              <RouteLayer 
                id="new-route" 
                coordinates={routePoints}
                color="#a855f7"
                width={5}
              />
            )}
            <RoutePointMarkers points={routePoints} />
          </BaseMap>

          {/* Drawing controls */}
          <div className="absolute top-4 left-4 flex gap-2">
            <Link href="/routes">
              <Button variant="secondary" size="sm">
                <ArrowLeft size={16} className="mr-1" />
                Back
              </Button>
            </Link>
          </div>

          <div className="absolute top-4 right-4 flex gap-2">
            <Button 
              variant={isDrawing ? 'primary' : 'outline'} 
              size="sm"
              onClick={() => setIsDrawing(!isDrawing)}
            >
              <MapPin size={16} className="mr-1" />
              {isDrawing ? 'Drawing Mode' : 'View Mode'}
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleUndo}
              disabled={routePoints.length === 0}
            >
              <Undo size={16} />
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleClear}
              disabled={routePoints.length === 0}
            >
              <Trash2 size={16} />
            </Button>
          </div>

          {/* Instructions overlay */}
          {routePoints.length === 0 && isDrawing && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-zinc-900/95 backdrop-blur-sm px-6 py-3 rounded-xl border border-zinc-800 shadow-lg">
              <div className="flex items-center gap-3 text-sm">
                <Info size={18} className="text-violet-500" />
                <span className="text-zinc-300">Click on the map to add route points</span>
              </div>
            </div>
          )}

          {/* Point counter */}
          {routePoints.length > 0 && (
            <div className="absolute bottom-6 left-6 bg-zinc-900/90 backdrop-blur-sm px-4 py-2 rounded-lg border border-zinc-800">
              <div className="flex items-center gap-2 text-sm text-zinc-300">
                <RouteIcon size={16} className="text-violet-500" />
                {routePoints.length} points
              </div>
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
              <p className="text-sm text-zinc-400">Draw your route on the map</p>
            </div>

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

            {/* Stats preview */}
            {routePoints.length >= 2 && (
              <div className="p-4 bg-zinc-800/50 rounded-lg space-y-2">
                <h3 className="text-sm font-medium text-zinc-300">Route Preview</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-zinc-500">Points</span>
                    <p className="text-white font-medium">{routePoints.length}</p>
                  </div>
                  <div>
                    <span className="text-zinc-500">Est. Distance</span>
                    <p className="text-white font-medium">
                      {(() => {
                        let d = 0;
                        for (let i = 1; i < routePoints.length; i++) {
                          const [lng1, lat1] = routePoints[i - 1];
                          const [lng2, lat2] = routePoints[i];
                          d += Math.sqrt(Math.pow(lng2 - lng1, 2) + Math.pow(lat2 - lat1, 2)) * 69;
                        }
                        return `${Math.round(d * 10) / 10} mi`;
                      })()}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-zinc-800 space-y-3">
              <Button
                className="w-full"
                onClick={handleSave}
                isLoading={isSaving}
                disabled={routePoints.length < 2 || !routeName}
              >
                <Save size={16} className="mr-2" />
                Save Route
              </Button>
              <p className="text-xs text-zinc-500 text-center">
                {routePoints.length < 2 
                  ? 'Add at least 2 points to save'
                  : !routeName 
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

// Separate component for markers to avoid hook issues
function RoutePointMarkers({ points }: { points: [number, number][] }) {
  const { map, isLoaded } = useMap();

  // Add markers for start/end points
  // For simplicity, we just show the start and end
  // A more complex implementation would show all waypoints

  return null; // Markers added via map layers instead
}
