'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button, Card, CardContent, Input } from '@/components/ui';
import { 
  Search, 
  Plus, 
  MapPin, 
  Star, 
  Clock, 
  TrendingUp,
  Filter,
  Mountain,
  Gauge
} from 'lucide-react';

// Mock data - replace with API calls
const MOCK_ROUTES = [
  {
    id: '1',
    name: 'Mulholland Drive Experience',
    description: 'Iconic LA canyon road with stunning views and technical turns',
    distanceMiles: 24.5,
    difficulty: 'CHALLENGING',
    avgRating: 4.8,
    driveCount: 1243,
    creatorUsername: 'speedracer',
    tags: ['canyon', 'views', 'technical'],
    thumbnailUrl: null,
  },
  {
    id: '2',
    name: 'Pacific Coast Highway Run',
    description: 'Scenic coastal drive from Malibu to Santa Monica',
    distanceMiles: 32.1,
    difficulty: 'EASY',
    avgRating: 4.9,
    driveCount: 2891,
    creatorUsername: 'coastalcruiser',
    tags: ['coastal', 'scenic', 'relaxing'],
    thumbnailUrl: null,
  },
  {
    id: '3',
    name: 'Angeles Crest Sprint',
    description: 'Mountain highway with elevation changes and sweeping turns',
    distanceMiles: 45.2,
    difficulty: 'EXPERT',
    avgRating: 4.7,
    driveCount: 876,
    creatorUsername: 'mountaingoat',
    tags: ['mountain', 'technical', 'long'],
    thumbnailUrl: null,
  },
  {
    id: '4',
    name: 'Griffith Park Loop',
    description: 'Quick urban canyon route with city views',
    distanceMiles: 8.3,
    difficulty: 'MODERATE',
    avgRating: 4.3,
    driveCount: 3421,
    creatorUsername: 'cityrider',
    tags: ['urban', 'short', 'views'],
    thumbnailUrl: null,
  },
];

const DIFFICULTY_COLORS = {
  EASY: 'bg-green-500/20 text-green-400',
  MODERATE: 'bg-yellow-500/20 text-yellow-400',
  CHALLENGING: 'bg-orange-500/20 text-orange-400',
  EXPERT: 'bg-red-500/20 text-red-400',
};

const DIFFICULTY_LABELS = {
  EASY: 'Easy',
  MODERATE: 'Moderate',
  CHALLENGING: 'Challenging',
  EXPERT: 'Expert',
};

export default function RoutesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'popular' | 'rating' | 'newest'>('popular');

  const filteredRoutes = MOCK_ROUTES.filter((route) => {
    const matchesSearch = route.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      route.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      route.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesDifficulty = !selectedDifficulty || route.difficulty === selectedDifficulty;
    
    return matchesSearch && matchesDifficulty;
  }).sort((a, b) => {
    if (sortBy === 'popular') return b.driveCount - a.driveCount;
    if (sortBy === 'rating') return b.avgRating - a.avgRating;
    return 0; // newest would need createdAt
  });

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
          {/* Difficulty filter */}
          <select
            value={selectedDifficulty || ''}
            onChange={(e) => setSelectedDifficulty(e.target.value || null)}
            className="px-4 py-2.5 bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option value="">All Difficulties</option>
            <option value="EASY">Easy</option>
            <option value="MODERATE">Moderate</option>
            <option value="CHALLENGING">Challenging</option>
            <option value="EXPERT">Expert</option>
          </select>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="px-4 py-2.5 bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option value="popular">Most Popular</option>
            <option value="rating">Top Rated</option>
            <option value="newest">Newest</option>
          </select>
        </div>
      </div>

      {/* Route cards */}
      <div className="grid md:grid-cols-2 gap-4">
        {filteredRoutes.map((route) => (
          <Link key={route.id} href={`/routes/${route.id}`}>
            <Card className="h-full hover:border-zinc-700 transition-all cursor-pointer group">
              <CardContent className="p-0">
                {/* Thumbnail/Map preview */}
                <div className="h-40 bg-zinc-800 rounded-t-xl relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-violet-500/20 to-transparent" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <MapPin size={48} className="text-zinc-600" />
                  </div>
                  {/* Difficulty badge */}
                  <div className={`absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-medium ${DIFFICULTY_COLORS[route.difficulty as keyof typeof DIFFICULTY_COLORS]}`}>
                    {DIFFICULTY_LABELS[route.difficulty as keyof typeof DIFFICULTY_LABELS]}
                  </div>
                </div>

                {/* Content */}
                <div className="p-4">
                  <h3 className="text-lg font-semibold text-white group-hover:text-violet-400 transition-colors mb-1">
                    {route.name}
                  </h3>
                  <p className="text-sm text-zinc-400 line-clamp-2 mb-3">
                    {route.description}
                  </p>

                  {/* Stats */}
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1 text-zinc-400">
                      <Gauge size={14} />
                      <span>{route.distanceMiles} mi</span>
                    </div>
                    <div className="flex items-center gap-1 text-yellow-400">
                      <Star size={14} fill="currentColor" />
                      <span>{route.avgRating}</span>
                    </div>
                    <div className="flex items-center gap-1 text-zinc-400">
                      <TrendingUp size={14} />
                      <span>{route.driveCount.toLocaleString()} drives</span>
                    </div>
                  </div>

                  {/* Tags */}
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

                  {/* Creator */}
                  <div className="mt-3 pt-3 border-t border-zinc-800 text-sm text-zinc-500">
                    by <span className="text-violet-400">@{route.creatorUsername}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {filteredRoutes.length === 0 && (
        <div className="text-center py-12">
          <MapPin size={48} className="mx-auto text-zinc-600 mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No routes found</h3>
          <p className="text-zinc-400 mb-4">Try adjusting your search or filters</p>
          <Link href="/routes/create">
            <Button>Create the first route</Button>
          </Link>
        </div>
      )}
    </div>
  );
}
