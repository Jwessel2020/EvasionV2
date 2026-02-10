'use client';

import { useState } from 'react';
import { Search, SlidersHorizontal, X, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LISTING_CATEGORIES, LISTING_CONDITIONS } from '@/lib/marketplace/constants';

interface ListingFiltersProps {
  filters: {
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
  };
  onFiltersChange: (filters: ListingFiltersProps['filters']) => void;
  states?: string[];
  makes?: string[];
  onClear?: () => void;
}

const US_STATES = [
  { value: 'AL', label: 'Alabama' },
  { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' },
  { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' },
  { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' },
  { value: 'DE', label: 'Delaware' },
  { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' },
  { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' },
  { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' },
  { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' },
  { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' },
  { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' },
  { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' },
  { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' },
  { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' },
  { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' },
  { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' },
  { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' },
  { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' },
  { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' },
  { value: 'WY', label: 'Wyoming' },
];

export function ListingFilters({
  filters,
  onFiltersChange,
  makes = [],
  onClear,
}: ListingFiltersProps) {
  const [showMore, setShowMore] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const updateFilter = (key: string, value: unknown) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const toggleCondition = (condition: string) => {
    const current = filters.condition || [];
    const updated = current.includes(condition)
      ? current.filter((c) => c !== condition)
      : [...current, condition];
    updateFilter('condition', updated.length > 0 ? updated : undefined);
  };

  const hasActiveFilters =
    filters.category ||
    (filters.condition && filters.condition.length > 0) ||
    filters.minPrice ||
    filters.maxPrice ||
    filters.state ||
    filters.make ||
    filters.freeShipping ||
    filters.localPickup;

  const filterContent = (
    <div className="space-y-6">
      {/* Categories */}
      <div>
        <h3 className="text-sm font-semibold text-zinc-300 mb-3">Category</h3>
        <div className="space-y-1">
          <button
            onClick={() => updateFilter('category', undefined)}
            className={cn(
              'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors',
              !filters.category
                ? 'bg-red-600 text-white'
                : 'text-zinc-400 hover:bg-zinc-800'
            )}
          >
            All Categories
          </button>
          {LISTING_CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => updateFilter('category', cat.value)}
              className={cn(
                'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors',
                filters.category === cat.value
                  ? 'bg-red-600 text-white'
                  : 'text-zinc-400 hover:bg-zinc-800'
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Condition */}
      <div>
        <h3 className="text-sm font-semibold text-zinc-300 mb-3">Condition</h3>
        <div className="space-y-2">
          {LISTING_CONDITIONS.map((cond) => (
            <label
              key={cond.value}
              className="flex items-center gap-2 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={filters.condition?.includes(cond.value) || false}
                onChange={() => toggleCondition(cond.value)}
                className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-red-500 focus:ring-red-500 focus:ring-offset-zinc-900"
              />
              <span className="text-sm text-zinc-300">{cond.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Price Range */}
      <div>
        <h3 className="text-sm font-semibold text-zinc-300 mb-3">Price</h3>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
              $
            </span>
            <input
              type="number"
              placeholder="Min"
              value={filters.minPrice || ''}
              onChange={(e) => updateFilter('minPrice', e.target.value || undefined)}
              className="w-full pl-7 pr-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
          <span className="text-zinc-500">-</span>
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
              $
            </span>
            <input
              type="number"
              placeholder="Max"
              value={filters.maxPrice || ''}
              onChange={(e) => updateFilter('maxPrice', e.target.value || undefined)}
              className="w-full pl-7 pr-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
        </div>
      </div>

      {/* Location */}
      <div>
        <h3 className="text-sm font-semibold text-zinc-300 mb-3">Location</h3>
        <select
          value={filters.state || ''}
          onChange={(e) => updateFilter('state', e.target.value || undefined)}
          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          <option value="">All States</option>
          {US_STATES.map((state) => (
            <option key={state.value} value={state.value}>
              {state.label}
            </option>
          ))}
        </select>
      </div>

      {/* Vehicle Compatibility */}
      <button
        onClick={() => setShowMore(!showMore)}
        className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors"
      >
        <span>Vehicle Compatibility</span>
        <ChevronDown
          className={cn('w-4 h-4 transition-transform', showMore && 'rotate-180')}
        />
      </button>

      {showMore && (
        <div className="space-y-3 pl-2 border-l-2 border-zinc-800">
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Make</label>
            <input
              type="text"
              placeholder="e.g., Honda, Toyota"
              value={filters.make || ''}
              onChange={(e) => updateFilter('make', e.target.value || undefined)}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500"
              list="makes-list"
            />
            {makes.length > 0 && (
              <datalist id="makes-list">
                {makes.map((make) => (
                  <option key={make} value={make} />
                ))}
              </datalist>
            )}
          </div>
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Model</label>
            <input
              type="text"
              placeholder="e.g., Civic, Camry"
              value={filters.model || ''}
              onChange={(e) => updateFilter('model', e.target.value || undefined)}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
        </div>
      )}

      {/* Shipping Options */}
      <div>
        <h3 className="text-sm font-semibold text-zinc-300 mb-3">Shipping</h3>
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.freeShipping || false}
              onChange={(e) => updateFilter('freeShipping', e.target.checked || undefined)}
              className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-red-500 focus:ring-red-500 focus:ring-offset-zinc-900"
            />
            <span className="text-sm text-zinc-300">Free Shipping</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.localPickup || false}
              onChange={(e) => updateFilter('localPickup', e.target.checked || undefined)}
              className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-red-500 focus:ring-red-500 focus:ring-offset-zinc-900"
            />
            <span className="text-sm text-zinc-300">Local Pickup</span>
          </label>
        </div>
      </div>

      {/* Clear Filters */}
      {hasActiveFilters && onClear && (
        <button
          onClick={onClear}
          className="w-full py-2 text-sm text-red-400 hover:text-red-300 transition-colors"
        >
          Clear All Filters
        </button>
      )}
    </div>
  );

  return (
    <>
      {/* Mobile Filter Button */}
      <div className="lg:hidden mb-4">
        <button
          onClick={() => setMobileOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white"
        >
          <SlidersHorizontal className="w-4 h-4" />
          Filters
          {hasActiveFilters && (
            <span className="px-1.5 py-0.5 bg-red-500 text-white text-xs rounded-full">
              {[
                filters.category,
                ...(filters.condition || []),
                filters.minPrice,
                filters.maxPrice,
                filters.state,
                filters.make,
                filters.freeShipping,
                filters.localPickup,
              ].filter(Boolean).length}
            </span>
          )}
        </button>
      </div>

      {/* Mobile Filter Modal */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-80 max-w-[85vw] bg-zinc-900 p-6 overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white">Filters</h2>
              <button
                onClick={() => setMobileOpen(false)}
                className="p-2 text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {filterContent}
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <div className="hidden lg:block w-64 flex-shrink-0">
        <div className="sticky top-20 bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          {filterContent}
        </div>
      </div>
    </>
  );
}
