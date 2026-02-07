'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Filter, X, RefreshCw, Car, MapPin } from 'lucide-react';
import { SpotForm, SpotCard, type SpotFormData } from '@/components/spotting';
import Link from 'next/link';

interface Spot {
  id: string;
  make?: string;
  model?: string;
  color?: string;
  year?: number;
  photos: string[];
  videoUrl?: string;
  description?: string;
  latitude: number;
  longitude: number;
  spottedAt: string;
  threadId?: string;
  likeCount: number;
  viewCount: number;
  spotter: {
    id: string;
    username: string;
    avatar?: string;
  };
}

export default function SpottingPage() {
  const [spots, setSpots] = useState<Spot[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    make: '',
    model: '',
    color: '',
  });
  const [error, setError] = useState<string | null>(null);

  // Fetch spots
  const fetchSpots = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('limit', '50');
      if (filters.make) params.set('make', filters.make);
      if (filters.model) params.set('model', filters.model);
      if (filters.color) params.set('color', filters.color);

      const res = await fetch(`/api/car-spotting?${params}`);
      const data = await res.json();

      if (data.success) {
        setSpots(data.data);
      } else {
        setError(data.error || 'Failed to load spots');
      }
    } catch (err) {
      setError('Failed to load spots');
      console.error('Error fetching spots:', err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchSpots();
  }, [fetchSpots]);

  // Submit new spot
  const handleSubmit = async (formData: SpotFormData) => {
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/car-spotting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (data.success) {
        setShowForm(false);
        // Add new spot to top of list
        const newSpot: Spot = {
          ...data.data,
          spotter: data.data.spotter || { id: '', username: 'You', avatar: null },
        };
        setSpots((prev) => [newSpot, ...prev]);
      } else {
        setError(data.error || 'Failed to create spot');
      }
    } catch (err) {
      setError('Failed to create spot');
      console.error('Error creating spot:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle map click from spot card
  const handleMapClick = (lat: number, lng: number) => {
    // Open map page centered on this location
    window.open(`/map?lat=${lat}&lng=${lng}&zoom=16`, '_blank');
  };

  return (
    <div className="min-h-screen bg-zinc-900 text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-zinc-900/80 backdrop-blur border-b border-zinc-800">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Car className="w-6 h-6 text-violet-500" />
              <h1 className="text-xl font-bold">Car Spotting</h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`p-2 rounded-lg transition-colors ${
                  showFilters ? 'bg-violet-600' : 'bg-zinc-800 hover:bg-zinc-700'
                }`}
              >
                <Filter className="w-5 h-5" />
              </button>
              <button
                onClick={fetchSpots}
                className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
                disabled={loading}
              >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="mt-4 p-4 bg-zinc-800 rounded-lg space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <input
                  type="text"
                  placeholder="Make"
                  value={filters.make}
                  onChange={(e) => setFilters((f) => ({ ...f, make: e.target.value }))}
                  className="px-3 py-2 bg-zinc-700 rounded-lg text-sm"
                />
                <input
                  type="text"
                  placeholder="Model"
                  value={filters.model}
                  onChange={(e) => setFilters((f) => ({ ...f, model: e.target.value }))}
                  className="px-3 py-2 bg-zinc-700 rounded-lg text-sm"
                />
                <input
                  type="text"
                  placeholder="Color"
                  value={filters.color}
                  onChange={(e) => setFilters((f) => ({ ...f, color: e.target.value }))}
                  className="px-3 py-2 bg-zinc-700 rounded-lg text-sm"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setFilters({ make: '', model: '', color: '' })}
                  className="px-3 py-1.5 text-sm text-zinc-400 hover:text-white transition-colors"
                >
                  Clear
                </button>
                <button
                  onClick={() => {
                    fetchSpots();
                    setShowFilters(false);
                  }}
                  className="px-4 py-1.5 bg-violet-600 hover:bg-violet-500 rounded-lg text-sm transition-colors"
                >
                  Apply
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-2xl mx-auto px-4 py-6">
        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)}>
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Spot form modal */}
        {showForm && (
          <div className="fixed inset-0 z-50 bg-black/70 flex items-end md:items-center justify-center">
            <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-zinc-900 md:rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">Spot a Car</h2>
                <button
                  onClick={() => setShowForm(false)}
                  className="p-2 hover:bg-zinc-800 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <SpotForm
                onSubmit={handleSubmit}
                onCancel={() => setShowForm(false)}
                isSubmitting={submitting}
              />
            </div>
          </div>
        )}

        {/* Loading state */}
        {loading && spots.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
            <RefreshCw className="w-8 h-8 animate-spin mb-4" />
            <p>Loading spots...</p>
          </div>
        )}

        {/* Empty state */}
        {!loading && spots.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
            <Car className="w-12 h-12 mb-4 opacity-50" />
            <p className="text-lg mb-2">No spots yet</p>
            <p className="text-sm mb-6">Be the first to spot a cool car!</p>
            <button
              onClick={() => setShowForm(true)}
              className="px-6 py-3 bg-violet-600 hover:bg-violet-500 rounded-lg transition-colors flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              <span>Spot a Car</span>
            </button>
          </div>
        )}

        {/* Spots grid/list */}
        {spots.length > 0 && (
          <div className="space-y-4">
            {spots.map((spot) => (
              <SpotCard
                key={spot.id}
                spot={spot}
                onMapClick={handleMapClick}
              />
            ))}
          </div>
        )}

        {/* Link to map */}
        {spots.length > 0 && (
          <div className="mt-6 text-center">
            <Link
              href="/map"
              className="inline-flex items-center gap-2 text-violet-400 hover:text-violet-300 transition-colors"
            >
              <MapPin className="w-4 h-4" />
              <span>View all spots on map</span>
            </Link>
          </div>
        )}
      </main>

      {/* FAB - Add new spot */}
      {!showForm && spots.length > 0 && (
        <button
          onClick={() => setShowForm(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-violet-600 hover:bg-violet-500 rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-110"
        >
          <Plus className="w-7 h-7" />
        </button>
      )}
    </div>
  );
}
