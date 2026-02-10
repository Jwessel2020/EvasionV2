'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { MapProvider, BaseMap } from '@/components/map';
import { RoutePreviewLayer } from '@/components/map/RoutePreviewLayer';
import { useMap } from '@/components/map/MapProvider';
import { RouteThumbnail } from '@/components/routes/RouteThumbnail';
import { Button, Card, CardContent } from '@/components/ui';
import { formatDuration } from '@/lib/mapbox/routing';
import {
  ArrowLeft,
  Gauge,
  Clock,
  Star,
  TrendingUp,
  Pencil,
  Trash2,
  MapPin,
  Navigation,
  Loader2,
  Share2,
} from 'lucide-react';

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
  driveCount: number;
  avgRating: number;
  creationMethod: string | null;
  createdAt: string;
  creator: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
  _count: { ratings: number };
}

const DIFFICULTY_COLORS: Record<string, string> = {
  EASY: 'bg-green-500/20 text-green-400 border-green-500/30',
  MODERATE: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  CHALLENGING: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  EXPERT: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const DIFFICULTY_LABELS: Record<string, string> = {
  EASY: 'Easy',
  MODERATE: 'Moderate',
  CHALLENGING: 'Challenging',
  EXPERT: 'Expert',
};

const DIFFICULTY_LINE_COLORS: Record<string, string> = {
  EASY: '#22c55e',
  MODERATE: '#eab308',
  CHALLENGING: '#f97316',
  EXPERT: '#ef4444',
};

function RouteMapFitter({ coordinates }: { coordinates: [number, number][] }) {
  const { map, isLoaded } = useMap();

  useEffect(() => {
    if (!map || !isLoaded || coordinates.length < 2) return;

    // Calculate bounds
    let minLng = Infinity, maxLng = -Infinity;
    let minLat = Infinity, maxLat = -Infinity;

    for (const [lng, lat] of coordinates) {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }

    map.fitBounds(
      [[minLng, minLat], [maxLng, maxLat]],
      { padding: 60, duration: 1000, maxZoom: 15 }
    );
  }, [map, isLoaded, coordinates]);

  return null;
}

export default function RouteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const routeId = params.id as string;

  const [route, setRoute] = useState<RouteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    async function fetchRoute() {
      try {
        const response = await fetch(`/api/routes/${routeId}`);
        const result = await response.json();

        if (result.success) {
          setRoute(result.data);
        } else {
          setError(result.error || 'Route not found');
        }
      } catch {
        setError('Failed to load route');
      } finally {
        setLoading(false);
      }
    }

    fetchRoute();
  }, [routeId]);

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this route?')) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/routes/${routeId}`, { method: 'DELETE' });
      const result = await response.json();

      if (result.success) {
        router.push('/routes');
      } else {
        alert(result.error || 'Failed to delete route');
        setDeleting(false);
      }
    } catch {
      alert('Failed to delete route');
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="h-[calc(100vh-8rem)] flex items-center justify-center">
        <div className="text-center">
          <Loader2 size={32} className="animate-spin text-violet-500 mx-auto mb-3" />
          <p className="text-zinc-400">Loading route...</p>
        </div>
      </div>
    );
  }

  if (error || !route) {
    return (
      <div className="h-[calc(100vh-8rem)] flex items-center justify-center">
        <div className="text-center">
          <MapPin size={48} className="text-zinc-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Route not found</h2>
          <p className="text-zinc-400 mb-4">{error}</p>
          <Link href="/routes">
            <Button variant="outline">Back to Routes</Button>
          </Link>
        </div>
      </div>
    );
  }

  const lineColor = DIFFICULTY_LINE_COLORS[route.difficulty] || '#8b5cf6';
  const duration = route.durationSeconds || route.estimatedTime;
  const startCoord = route.pathCoordinates[0];
  const endCoord = route.pathCoordinates[route.pathCoordinates.length - 1];

  return (
    <div className="h-[calc(100vh-8rem)] flex gap-0">
      {/* Map */}
      <div className="flex-1 relative rounded-l-xl overflow-hidden">
        <MapProvider>
          <BaseMap
            initialCenter={startCoord}
            initialZoom={12}
            className="w-full h-full"
          >
            <RoutePreviewLayer
              id="route-view"
              coordinates={route.pathCoordinates}
              color={lineColor}
              outlineColor="#18181b"
              width={5}
              outlineWidth={7}
              opacity={0.95}
            />
            <RouteMapFitter coordinates={route.pathCoordinates} />
          </BaseMap>
        </MapProvider>

        {/* Back button overlay */}
        <div className="absolute top-4 left-4 z-10">
          <Link href="/routes">
            <Button variant="outline" size="sm" className="bg-zinc-900/80 backdrop-blur-sm border-zinc-700">
              <ArrowLeft size={16} className="mr-1" />
              Back
            </Button>
          </Link>
        </div>
      </div>

      {/* Info Panel */}
      <div className="w-[380px] bg-zinc-900 border-l border-zinc-800 overflow-y-auto">
        <div className="p-6 space-y-6">
          {/* Header */}
          <div>
            <div className="flex items-start justify-between gap-3 mb-3">
              <h1 className="text-2xl font-bold text-white leading-tight">{route.name}</h1>
              <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium border ${DIFFICULTY_COLORS[route.difficulty] || ''}`}>
                {DIFFICULTY_LABELS[route.difficulty] || route.difficulty}
              </span>
            </div>
            {route.description && (
              <p className="text-zinc-400 text-sm leading-relaxed">{route.description}</p>
            )}
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="bg-zinc-800/50 border-zinc-700/50">
              <CardContent className="p-3 text-center">
                <Gauge size={18} className="mx-auto mb-1 text-violet-400" />
                <div className="text-lg font-bold text-white">{route.distanceMiles} mi</div>
                <div className="text-xs text-zinc-500">Distance</div>
              </CardContent>
            </Card>
            <Card className="bg-zinc-800/50 border-zinc-700/50">
              <CardContent className="p-3 text-center">
                <Clock size={18} className="mx-auto mb-1 text-violet-400" />
                <div className="text-lg font-bold text-white">
                  {duration ? formatDuration(duration) : '--'}
                </div>
                <div className="text-xs text-zinc-500">Duration</div>
              </CardContent>
            </Card>
            <Card className="bg-zinc-800/50 border-zinc-700/50">
              <CardContent className="p-3 text-center">
                <Star size={18} className="mx-auto mb-1 text-yellow-400" />
                <div className="text-lg font-bold text-white">
                  {route.avgRating > 0 ? route.avgRating.toFixed(1) : '--'}
                </div>
                <div className="text-xs text-zinc-500">
                  {route._count.ratings} rating{route._count.ratings !== 1 ? 's' : ''}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-zinc-800/50 border-zinc-700/50">
              <CardContent className="p-3 text-center">
                <TrendingUp size={18} className="mx-auto mb-1 text-violet-400" />
                <div className="text-lg font-bold text-white">{route.driveCount.toLocaleString()}</div>
                <div className="text-xs text-zinc-500">Drives</div>
              </CardContent>
            </Card>
          </div>

          {/* Route Preview Thumbnail */}
          <Card className="bg-zinc-800/50 border-zinc-700/50">
            <CardContent className="p-3">
              <div className="h-24">
                <RouteThumbnail
                  coordinates={route.pathCoordinates}
                  color={lineColor}
                />
              </div>
            </CardContent>
          </Card>

          {/* Tags */}
          {route.tags.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-zinc-400 mb-2">Tags</h3>
              <div className="flex flex-wrap gap-2">
                {route.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2.5 py-1 bg-zinc-800 rounded-lg text-xs text-zinc-300 border border-zinc-700/50"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Creator */}
          <div className="flex items-center gap-3 p-3 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
            <div className="w-10 h-10 rounded-full bg-violet-500/20 flex items-center justify-center">
              <span className="text-violet-400 font-bold text-sm">
                {route.creator.displayName?.[0]?.toUpperCase() || '?'}
              </span>
            </div>
            <div>
              <div className="text-sm font-medium text-white">{route.creator.displayName}</div>
              <div className="text-xs text-zinc-500">@{route.creator.username}</div>
            </div>
          </div>

          {/* Meta info */}
          <div className="text-xs text-zinc-600 space-y-1">
            {route.creationMethod && (
              <div>Created via {route.creationMethod === 'manual' ? 'drawing' : 'GPS recording'}</div>
            )}
            <div>Added {new Date(route.createdAt).toLocaleDateString()}</div>
          </div>

          {/* Actions */}
          <div className="space-y-2 pt-2 border-t border-zinc-800">
            <Link href={`/routes/${route.id}/edit`} className="block">
              <Button variant="outline" className="w-full">
                <Pencil size={16} className="mr-2" />
                Edit Route
              </Button>
            </Link>
            <Button
              variant="outline"
              className="w-full text-red-400 hover:text-red-300 hover:border-red-500/30"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? (
                <Loader2 size={16} className="mr-2 animate-spin" />
              ) : (
                <Trash2 size={16} className="mr-2" />
              )}
              Delete Route
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
