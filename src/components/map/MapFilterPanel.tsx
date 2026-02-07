'use client';

import { useState } from 'react';
import { Button } from '@/components/ui';
import { 
  Filter, 
  X, 
  ChevronDown, 
  ChevronUp,
  AlertTriangle,
  Car,
  Clock,
  Calendar,
  Gauge,
  Zap,
  Radio,
  MapPin,
  Target,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MapFilters {
  violationType: string | null;
  hasAlcohol: boolean | null;
  hasAccident: boolean | null;
  hourStart: number | null;
  hourEnd: number | null;
  dayOfWeek: number | null;
  year: number | null;
  // Speed-related filters
  speedOnly: boolean | null;
  detectionMethod: string | null; // radar, laser, vascar, patrol
  minSpeedOver: number | null;
  speedTrapsOnly: boolean | null; // Show only likely speed trap locations
  vehicleMake: string | null;
  searchConducted: boolean | null;
  // ML Prediction overlay
  showPredictions: boolean | null;
}

interface MapFilterPanelProps {
  filters: MapFilters;
  onFiltersChange: (filters: MapFilters) => void;
  className?: string;
  vehicleMakes?: Array<{ make: string; count: number }>;
}

const VIOLATION_TYPES = [
  { value: null, label: 'All Types' },
  { value: 'Citation', label: 'Citation' },
  { value: 'Warning', label: 'Warning' },
  { value: 'ESERO', label: 'ESERO' },
];

const DAYS = [
  { value: null, label: 'All Days' },
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

const TIME_RANGES = [
  { value: null, label: 'All Hours' },
  { value: [0, 5], label: 'Late Night (12am-6am)' },
  { value: [6, 9], label: 'Morning Rush (6am-10am)' },
  { value: [10, 14], label: 'Midday (10am-3pm)' },
  { value: [15, 18], label: 'Evening Rush (3pm-7pm)' },
  { value: [19, 23], label: 'Night (7pm-12am)' },
];

const DETECTION_METHODS = [
  { value: null, label: 'All Methods' },
  { value: 'radar', label: '📡 Radar' },
  { value: 'laser', label: '⚡ Laser' },
  { value: 'vascar', label: '⏱️ VASCAR' },
  { value: 'patrol', label: '🚔 Patrol' },
];

const SPEED_OVER_OPTIONS = [
  { value: null, label: 'Any Speed' },
  { value: 10, label: '10+ mph over' },
  { value: 15, label: '15+ mph over' },
  { value: 20, label: '20+ mph over' },
  { value: 25, label: '25+ mph over' },
  { value: 30, label: '30+ mph over' },
];

// Removed hardcoded VEHICLE_MAKES - now passed as prop from parent

// Generate years from current year back to 2012 (typical data range)
const currentYear = new Date().getFullYear();
const YEARS = [
  { value: null, label: 'All Years' },
  ...Array.from({ length: currentYear - 2011 }, (_, i) => ({
    value: currentYear - i,
    label: (currentYear - i).toString(),
  })),
];

export function MapFilterPanel({
  filters,
  onFiltersChange,
  className,
  vehicleMakes = [],
}: MapFilterPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Build vehicle makes options from prop
  const vehicleMakeOptions = [
    { value: null, label: 'All Makes' },
    ...vehicleMakes.map(vm => ({
      value: vm.make,
      label: vm.make.split(' ').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' '), // Proper case
    })),
  ];

  const activeFilterCount = [
    filters.violationType,
    filters.hasAlcohol,
    filters.hasAccident,
    filters.hourStart !== null,
    filters.dayOfWeek !== null,
    filters.year !== null,
    filters.speedOnly,
    filters.detectionMethod,
    filters.minSpeedOver !== null,
    filters.speedTrapsOnly,
    filters.vehicleMake,
    filters.searchConducted,
  ].filter(Boolean).length;

  const clearFilters = () => {
    onFiltersChange({
      violationType: null,
      hasAlcohol: null,
      hasAccident: null,
      hourStart: null,
      hourEnd: null,
      dayOfWeek: null,
      year: null,
      speedOnly: null,
      detectionMethod: null,
      minSpeedOver: null,
      speedTrapsOnly: null,
      vehicleMake: null,
      searchConducted: null,
      showPredictions: null,
    });
  };

  const updateFilter = <K extends keyof MapFilters>(key: K, value: MapFilters[K]) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  return (
    <div
      className={cn(
        'bg-zinc-900/95 backdrop-blur-sm border border-zinc-800 rounded-xl shadow-xl overflow-hidden',
        className
      )}
    >
      {/* Header */}
      <button
        className="w-full p-3 flex items-center justify-between hover:bg-zinc-800/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <Filter size={18} className="text-violet-500" />
          <span className="font-medium text-white">Filters</span>
          {activeFilterCount > 0 && (
            <span className="px-2 py-0.5 bg-violet-500/20 text-violet-400 text-xs rounded-full">
              {activeFilterCount}
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp size={18} className="text-zinc-400" />
        ) : (
          <ChevronDown size={18} className="text-zinc-400" />
        )}
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="p-3 pt-0 space-y-4 border-t border-zinc-800">
          {/* Violation Type */}
          <div>
            <label className="text-xs text-zinc-400 mb-1.5 block flex items-center gap-1">
              <Car size={12} />
              Violation Type
            </label>
            <select
              value={filters.violationType || ''}
              onChange={(e) => updateFilter('violationType', e.target.value || null)}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              {VIOLATION_TYPES.map((type) => (
                <option key={type.label} value={type.value || ''}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* Quick Filters */}
          <div>
            <label className="text-xs text-zinc-400 mb-1.5 block flex items-center gap-1">
              <AlertTriangle size={12} />
              Incident Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => updateFilter('hasAlcohol', filters.hasAlcohol === true ? null : true)}
                className={cn(
                  'px-3 py-2 rounded-lg text-sm font-medium transition-colors border',
                  filters.hasAlcohol === true
                    ? 'bg-red-500/20 border-red-500/50 text-red-400'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600'
                )}
              >
                🍺 Alcohol
              </button>
              <button
                onClick={() => updateFilter('hasAccident', filters.hasAccident === true ? null : true)}
                className={cn(
                  'px-3 py-2 rounded-lg text-sm font-medium transition-colors border',
                  filters.hasAccident === true
                    ? 'bg-orange-500/20 border-orange-500/50 text-orange-400'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600'
                )}
              >
                💥 Accident
              </button>
              <button
                onClick={() => updateFilter('searchConducted', filters.searchConducted === true ? null : true)}
                className={cn(
                  'px-3 py-2 rounded-lg text-sm font-medium transition-colors border',
                  filters.searchConducted === true
                    ? 'bg-purple-500/20 border-purple-500/50 text-purple-400'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600'
                )}
              >
                🔍 Search
              </button>
            </div>
          </div>

          {/* ML Risk Prediction Toggle */}
          <div>
            <label className="text-xs text-zinc-400 mb-1.5 block flex items-center gap-1">
              <MapPin size={12} />
              AI Risk Prediction
            </label>
            <button
              onClick={() => updateFilter('showPredictions', filters.showPredictions === true ? null : true)}
              className={cn(
                'w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors border flex items-center justify-center gap-2',
                filters.showPredictions === true
                  ? 'bg-purple-500/20 border-purple-500/50 text-purple-400'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600'
              )}
            >
              🔮 {filters.showPredictions ? 'Prediction Heatmap ON' : 'Show Risk Prediction'}
            </button>
            <p className="text-xs text-zinc-500 mt-1">
              ML-based enforcement probability by location and time
            </p>
          </div>

          {/* Speed Filter Toggle */}
          <div>
            <label className="text-xs text-zinc-400 mb-1.5 block flex items-center gap-1">
              <Gauge size={12} />
              Speed Violations
            </label>
            <button
              onClick={() => updateFilter('speedOnly', filters.speedOnly === true ? null : true)}
              className={cn(
                'w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors border flex items-center justify-center gap-2',
                filters.speedOnly === true
                  ? 'bg-blue-500/20 border-blue-500/50 text-blue-400'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600'
              )}
            >
              <Gauge size={16} />
              {filters.speedOnly ? 'Showing Speed Only' : 'Show Speed Violations Only'}
            </button>
          </div>

          {/* Speed-specific filters (only shown when speedOnly is enabled) */}
          {filters.speedOnly && (
            <>
              {/* Detection Method */}
              <div>
                <label className="text-xs text-zinc-400 mb-1.5 block flex items-center gap-1">
                  <Radio size={12} />
                  Detection Method
                </label>
                <select
                  value={filters.detectionMethod || ''}
                  onChange={(e) => updateFilter('detectionMethod', e.target.value || null)}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {DETECTION_METHODS.map((method) => (
                    <option key={method.label} value={method.value || ''}>
                      {method.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Minimum Speed Over */}
              <div>
                <label className="text-xs text-zinc-400 mb-1.5 block flex items-center gap-1">
                  <Zap size={12} />
                  Minimum Speed Over Limit
                </label>
                <select
                  value={filters.minSpeedOver ?? ''}
                  onChange={(e) => updateFilter('minSpeedOver', e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {SPEED_OVER_OPTIONS.map((opt) => (
                    <option key={opt.label} value={opt.value ?? ''}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Speed Trap Detection */}
              <div>
                <label className="text-xs text-zinc-400 mb-1.5 block flex items-center gap-1">
                  <Target size={12} />
                  Speed Trap Detection
                </label>
                <button
                  onClick={() => updateFilter('speedTrapsOnly', filters.speedTrapsOnly === true ? null : true)}
                  className={cn(
                    'w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors border flex items-center justify-center gap-2',
                    filters.speedTrapsOnly === true
                      ? 'bg-red-500/20 border-red-500/50 text-red-400'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600'
                  )}
                >
                  <Target size={16} />
                  {filters.speedTrapsOnly ? 'Showing Speed Traps' : 'Show Likely Speed Traps'}
                </button>
                <p className="text-xs text-zinc-500 mt-1">
                  Locations with stationary radar/laser and high stop frequency
                </p>
              </div>
            </>
          )}

          {/* Time Range */}
          <div>
            <label className="text-xs text-zinc-400 mb-1.5 block flex items-center gap-1">
              <Clock size={12} />
              Time of Day
            </label>
            <select
              value={filters.hourStart !== null ? `${filters.hourStart}-${filters.hourEnd}` : ''}
              onChange={(e) => {
                if (!e.target.value) {
                  updateFilter('hourStart', null);
                  onFiltersChange({ ...filters, hourStart: null, hourEnd: null });
                } else {
                  const [start, end] = e.target.value.split('-').map(Number);
                  onFiltersChange({ ...filters, hourStart: start, hourEnd: end });
                }
              }}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              {TIME_RANGES.map((range) => (
                <option 
                  key={range.label} 
                  value={range.value ? `${range.value[0]}-${range.value[1]}` : ''}
                >
                  {range.label}
                </option>
              ))}
            </select>
          </div>

          {/* Day of Week */}
          <div>
            <label className="text-xs text-zinc-400 mb-1.5 block flex items-center gap-1">
              <Calendar size={12} />
              Day of Week
            </label>
            <select
              value={filters.dayOfWeek ?? ''}
              onChange={(e) => updateFilter('dayOfWeek', e.target.value ? parseInt(e.target.value) : null)}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              {DAYS.map((day) => (
                <option key={day.label} value={day.value ?? ''}>
                  {day.label}
                </option>
              ))}
            </select>
          </div>

          {/* Year Filter */}
          <div>
            <label className="text-xs text-zinc-400 mb-1.5 block flex items-center gap-1">
              <Calendar size={12} />
              Year
            </label>
            <select
              value={filters.year ?? ''}
              onChange={(e) => updateFilter('year', e.target.value ? parseInt(e.target.value) : null)}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              {YEARS.map((year) => (
                <option key={year.label} value={year.value ?? ''}>
                  {year.label}
                </option>
              ))}
            </select>
          </div>

          {/* Vehicle Make Filter */}
          <div>
            <label className="text-xs text-zinc-400 mb-1.5 block flex items-center gap-1">
              <Car size={12} />
              Vehicle Make
            </label>
            <select
              value={filters.vehicleMake ?? ''}
              onChange={(e) => updateFilter('vehicleMake', e.target.value || null)}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              {vehicleMakeOptions.map((make) => (
                <option key={make.label} value={make.value ?? ''}>
                  {make.label}
                </option>
              ))}
            </select>
          </div>

          {/* Clear Button */}
          {activeFilterCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="w-full"
            >
              <X size={14} className="mr-1" />
              Clear All Filters
            </Button>
          )}

          {/* Legend */}
          <div className="pt-2 border-t border-zinc-800">
            <p className="text-xs text-zinc-500 mb-2">Point Colors</p>
            <div className="grid grid-cols-2 gap-1 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-zinc-400">Alcohol</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-orange-500" />
                <span className="text-zinc-400">Accident</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="text-zinc-400">Citation</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-zinc-400">Warning</span>
              </div>
              {filters.speedOnly && (
                <>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-cyan-500" />
                    <span className="text-zinc-400">Speed (low)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-yellow-500" />
                    <span className="text-zinc-400">Speed (high)</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
