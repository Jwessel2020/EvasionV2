'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Loader2, Grid, List, SlidersHorizontal, ChevronDown } from 'lucide-react';
import { ListingCard, ListingFilters } from '@/components/marketplace';
import { LISTING_CATEGORIES } from '@/lib/marketplace/constants';
import { cn } from '@/lib/utils';

interface Listing {
  _id: string;
  title: string;
  slug: string;
  price: number;
  originalPrice?: number;
  condition: string;
  category: string;
  images: { url: string; thumbnail?: string }[];
  location?: { city?: string; state?: string };
  shipping?: { freeShipping?: boolean; localPickup?: boolean };
  sellerUsername: string;
  sellerAvatar?: string;
  shopName?: string;
  shopSlug?: string;
  isFeatured?: boolean;
  viewCount?: number;
  saveCount?: number;
  createdAt: string;
}

const sortOptions = [
  { value: 'newest', label: 'Newest First' },
  { value: 'priceAsc', label: 'Price: Low to High' },
  { value: 'priceDesc', label: 'Price: High to Low' },
  { value: 'popular', label: 'Most Popular' },
];

function MarketplaceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Parse filters from URL
  const filters: {
    search?: string;
    category?: string;
    condition?: string[];
    minPrice?: string;
    maxPrice?: string;
    state?: string;
    make?: string;
    model?: string;
    freeShipping?: boolean;
    localPickup?: boolean;
  } = {
    search: searchParams.get('search') || undefined,
    category: searchParams.get('category') || undefined,
    condition: searchParams.get('condition')?.split(',') || undefined,
    minPrice: searchParams.get('minPrice') || undefined,
    maxPrice: searchParams.get('maxPrice') || undefined,
    state: searchParams.get('state') || undefined,
    make: searchParams.get('make') || undefined,
    model: searchParams.get('model') || undefined,
    freeShipping: searchParams.get('freeShipping') === 'true' || undefined,
    localPickup: searchParams.get('localPickup') === 'true' || undefined,
  };

  const sort = searchParams.get('sort') || 'newest';
  const page = parseInt(searchParams.get('page') || '1');

  useEffect(() => {
    fetchListings();
  }, [searchParams]);

  const fetchListings = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();

      if (filters.search) params.set('search', filters.search);
      if (filters.category) params.set('category', filters.category);
      if (filters.condition?.length) params.set('condition', filters.condition.join(','));
      if (filters.minPrice) params.set('minPrice', filters.minPrice);
      if (filters.maxPrice) params.set('maxPrice', filters.maxPrice);
      if (filters.state) params.set('state', filters.state);
      if (filters.make) params.set('make', filters.make);
      if (filters.model) params.set('model', filters.model);
      if (filters.freeShipping) params.set('freeShipping', 'true');
      if (filters.localPickup) params.set('localPickup', 'true');
      params.set('sort', sort);
      params.set('page', page.toString());

      const res = await fetch(`/api/marketplace/listings?${params}`);
      const data = await res.json();

      if (data.success) {
        setListings(data.data);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error('Error fetching listings:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateURL = (updates: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams);

    Object.entries(updates).forEach(([key, value]) => {
      if (value === undefined || value === '' || value === 'false') {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });

    // Reset page when filters change
    if (!updates.page) {
      params.delete('page');
    }

    router.push(`/marketplace?${params.toString()}`);
  };

  const handleFiltersChange = (newFilters: typeof filters) => {
    const updates: Record<string, string | undefined> = {};

    if (newFilters.category !== filters.category) {
      updates.category = newFilters.category;
    }
    if (JSON.stringify(newFilters.condition) !== JSON.stringify(filters.condition)) {
      updates.condition = newFilters.condition?.join(',');
    }
    if (newFilters.minPrice !== filters.minPrice) {
      updates.minPrice = newFilters.minPrice;
    }
    if (newFilters.maxPrice !== filters.maxPrice) {
      updates.maxPrice = newFilters.maxPrice;
    }
    if (newFilters.state !== filters.state) {
      updates.state = newFilters.state;
    }
    if (newFilters.make !== filters.make) {
      updates.make = newFilters.make;
    }
    if (newFilters.model !== filters.model) {
      updates.model = newFilters.model;
    }
    if (newFilters.freeShipping !== filters.freeShipping) {
      updates.freeShipping = newFilters.freeShipping ? 'true' : undefined;
    }
    if (newFilters.localPickup !== filters.localPickup) {
      updates.localPickup = newFilters.localPickup ? 'true' : undefined;
    }

    updateURL(updates);
  };

  const handleSortChange = (newSort: string) => {
    updateURL({ sort: newSort });
  };

  const handlePageChange = (newPage: number) => {
    updateURL({ page: newPage.toString() });
  };

  const clearFilters = () => {
    router.push('/marketplace');
  };

  const categoryLabel = filters.category
    ? LISTING_CATEGORIES.find((c) => c.value === filters.category)?.label
    : null;

  return (
    <div className="flex gap-6 p-6">
      {/* Filters Sidebar */}
      <ListingFilters
        filters={filters}
        onFiltersChange={handleFiltersChange}
        onClear={clearFilters}
      />

      {/* Main Content */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">
              {filters.search
                ? `Results for "${filters.search}"`
                : categoryLabel
                ? categoryLabel
                : 'All Listings'}
            </h1>
            <p className="text-sm text-zinc-400">
              {pagination.total.toLocaleString()} listing{pagination.total !== 1 ? 's' : ''} found
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Sort */}
            <div className="relative">
              <select
                value={sort}
                onChange={(e) => handleSortChange(e.target.value)}
                className="appearance-none bg-zinc-900 border border-zinc-700 rounded-lg pl-3 pr-10 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
            </div>

            {/* View Toggle */}
            <div className="hidden sm:flex items-center bg-zinc-900 border border-zinc-700 rounded-lg p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={cn(
                  'p-1.5 rounded transition-colors',
                  viewMode === 'grid'
                    ? 'bg-zinc-700 text-white'
                    : 'text-zinc-400 hover:text-white'
                )}
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  'p-1.5 rounded transition-colors',
                  viewMode === 'list'
                    ? 'bg-zinc-700 text-white'
                    : 'text-zinc-400 hover:text-white'
                )}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
          </div>
        ) : listings.length === 0 ? (
          /* Empty State */
          <div className="text-center py-20">
            <div className="w-20 h-20 mx-auto mb-4 bg-zinc-800 rounded-full flex items-center justify-center">
              <SlidersHorizontal className="w-8 h-8 text-zinc-500" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">No listings found</h2>
            <p className="text-zinc-400 mb-4">
              Try adjusting your filters or search terms
            </p>
            <button
              onClick={clearFilters}
              className="text-red-500 hover:text-red-400 font-medium"
            >
              Clear all filters
            </button>
          </div>
        ) : (
          /* Listings Grid */
          <>
            <div
              className={cn(
                'grid gap-4',
                viewMode === 'grid'
                  ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                  : 'grid-cols-1'
              )}
            >
              {listings.map((listing) => (
                <ListingCard
                  key={listing._id}
                  listing={listing}
                  compact={viewMode === 'grid'}
                />
              ))}
            </div>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <button
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page === 1}
                  className="px-4 py-2 bg-zinc-800 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-700 transition-colors"
                >
                  Previous
                </button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                    let pageNum: number;
                    if (pagination.pages <= 5) {
                      pageNum = i + 1;
                    } else if (page <= 3) {
                      pageNum = i + 1;
                    } else if (page >= pagination.pages - 2) {
                      pageNum = pagination.pages - 4 + i;
                    } else {
                      pageNum = page - 2 + i;
                    }

                    return (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        className={cn(
                          'w-10 h-10 rounded-lg font-medium transition-colors',
                          page === pageNum
                            ? 'bg-red-600 text-white'
                            : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white'
                        )}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page === pagination.pages}
                  className="px-4 py-2 bg-zinc-800 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-700 transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function MarketplacePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
        </div>
      }
    >
      <MarketplaceContent />
    </Suspense>
  );
}
