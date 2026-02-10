'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button, Card, CardContent } from '@/components/ui';
import { RouteThumbnail } from '@/components/routes/RouteThumbnail';
import {
  Search,
  Plus,
  MapPin,
  Star,
  TrendingUp,
  Gauge,
  Loader2,
} from 'lucide-react';

interface RouteItem {
  id: string;
  name: string;
  description: string | null;
  pathCoordinates: [number, number][];
  distanceMiles: number;
  difficulty: string;
  avgRating: number;
  driveCount: number;
  tags: string[];
  createdAt: string;
  creator: {
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
  _count: { ratings: number };
}

const DIFFICULTY_COLORS: Record<string, string> = {
  EASY: 'bg-green-500/20 text-green-400',
  MODERATE: 'bg-yellow-500/20 text-yellow-400',
  CHALLENGING: 'bg-orange-500/20 text-orange-400',
  EXPERT: 'bg-red-500/20 text-red-400',
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

export default function RoutesPage() {
  const [routes, setRoutes] = useState<RouteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('popular');

  const fetchRoutes = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set('search', searchQuery);
      if (selectedDifficulty) params.set('difficulty', selectedDifficulty);

      const sortMap: Record<string, string> = {
        popular: 'driveCount',
        rating: 'rating',
        newest: 'newest',
      };
      params.set('sortBy', sortMap[sortBy] || 'driveCount');
      params.set('limit', '50');

      const response = await fetch(`/api/routes?${params}`);
      const result = await response.json();

      if (result.success) {
        setRoutes(result.data);
      }
    } catch (err) {
      console.error('Error fetching routes:', err);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedDifficulty, sortBy]);

  useEffect(() => {
    const timeout = setTimeout(fetchRoutes, 300);
    return () => clearTimeout(timeout);
  }, [fetchRoutes]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Discover Routes</h1>
          <p className="text-zinc-400 mt-1">Find your next adventure</p>
        </div>
        <Link href="/routes/create">
          <Button>
            <Plus size={18} className="mr-2" />
            Create Route
          </Button>
        </Link>
      </div>

      {/* Search and filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Search routes, tags, locations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
          />
        </div>

        <div className="flex gap-2">
          <select
            value={selectedDifficulty}
            onChange={(e) => setSelectedDifficulty(e.target.value)}
            className="px-4 py-2.5 bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option value="">All Difficulties</option>
            <option value="EASY">Easy</option>
            <option value="MODERATE">Moderate</option>
            <option value="CHALLENGING">Challenging</option>
            <option value="EXPERT">Expert</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-4 py-2.5 bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option value="popular">Most Popular</option>
            <option value="rating">Top Rated</option>
            <option value="newest">Newest</option>
          </select>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="grid md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-0">
                <div className="h-40 bg-zinc-800 rounded-t-xl" />
                <div className="p-4 space-y-3">
                  <div className="h-5 bg-zinc-800 rounded w-3/4" />
                  <div className="h-4 bg-zinc-800 rounded w-full" />
                  <div className="h-4 bg-zinc-800 rounded w-1/2" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Route cards */}
      {!loading && routes.length > 0 && (
        <div className="grid md:grid-cols-2 gap-4">
          {routes.map((route) => (
            <Link key={route.id} href={`/routes/${route.id}`}>
              <Card className="h-full hover:border-violet-500/30 transition-all cursor-pointer group">
                <CardContent className="p-0">
                  {/* Thumbnail */}
                  <div className="h-40 bg-zinc-900/80 rounded-t-xl relative overflow-hidden">
                    {route.pathCoordinates && route.pathCoordinates.length >= 2 ? (
                      <RouteThumbnail
                        coordinates={route.pathCoordinates}
                        color={DIFFICULTY_LINE_COLORS[route.difficulty] || '#8b5cf6'}
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <MapPin size={48} className="text-zinc-700" />
                      </div>
                    )}
                    {/* Difficulty badge */}
                    <div className={`absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-medium ${DIFFICULTY_COLORS[route.difficulty] || ''}`}>
                      {DIFFICULTY_LABELS[route.difficulty] || route.difficulty}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-4">
                    <h3 className="text-lg font-semibold text-white group-hover:text-violet-400 transition-colors mb-1">
                      {route.name}
                    </h3>
                    {route.description && (
                      <p className="text-sm text-zinc-400 line-clamp-2 mb-3">
                        {route.description}
                      </p>
                    )}

                    {/* Stats */}
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1 text-zinc-400">
                        <Gauge size={14} />
                        <span>{route.distanceMiles} mi</span>
                      </div>
                      {route.avgRating > 0 && (
                        <div className="flex items-center gap-1 text-yellow-400">
                          <Star size={14} fill="currentColor" />
                          <span>{route.avgRating.toFixed(1)}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1 text-zinc-400">
                        <TrendingUp size={14} />
                        <span>{route.driveCount.toLocaleString()} drives</span>
                      </div>
                    </div>

                    {/* Tags */}
                    {route.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {route.tags.map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 bg-zinc-800 rounded text-xs text-zinc-400"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Creator */}
                    <div className="mt-3 pt-3 border-t border-zinc-800 text-sm text-zinc-500">
                      by <span className="text-violet-400">@{route.creator?.username || 'unknown'}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && routes.length === 0 && (
        <div className="text-center py-12">
          <MapPin size={48} className="mx-auto text-zinc-600 mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No routes found</h3>
          <p className="text-zinc-400 mb-4">
            {searchQuery || selectedDifficulty
              ? 'Try adjusting your search or filters'
              : 'Create your first route to get started'}
          </p>
          <Link href="/routes/create">
            <Button>Create a Route</Button>
          </Link>
        </div>
      )}
    </div>
  );
}
