'use client';

import { useState } from 'react';
import { Button, FilterSection, FilterSelect, QuickToggle } from '@/components/ui';
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
import {
  VIOLATION_TYPES,
  DAYS_FILTER,
  TIME_RANGES,
  DETECTION_METHODS,
  SPEED_OVER_OPTIONS,
  YEARS_FILTER,
  POINT_COLORS,
} from '@/lib/analytics-constants';

export interface MapFilters {
  violationType: string | null;
  hasAlcohol: boolean | null;
  hasAccident: boolean | null;
  hourStart: number | null;
  hourEnd: number | null;
  dayOfWeek: number | null;
  year: number | null;
  speedOnly: boolean | null;
  detectionMethod: string | null;
  minSpeedOver: number | null;
  speedTrapsOnly: boolean | null;
  vehicleMake: string | null;
  searchConducted: boolean | null;
  vehicleMarking: 'marked' | 'unmarked' | null;
  showPredictions: boolean | null;
}

interface MapFilterPanelProps {
  filters: MapFilters;
  onFiltersChange: (filters: MapFilters) => void;
  className?: string;
  vehicleMakes?: Array<{ make: string; count: number }>;
}

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
      label: vm.make.split(' ').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' '),
    })),
  ];

  // Count active filters per section
  const basicFilterCount = [
    filters.violationType,
    filters.hasAlcohol,
    filters.hasAccident,
    filters.searchConducted,
    filters.vehicleMarking,
  ].filter(Boolean).length;

  const speedFilterCount = [
    filters.speedOnly,
    filters.detectionMethod,
    filters.minSpeedOver !== null,
    filters.speedTrapsOnly,
  ].filter(Boolean).length;

  const timeFilterCount = [
    filters.hourStart !== null,
    filters.dayOfWeek !== null,
    filters.year !== null,
  ].filter(Boolean).length;

  const advancedFilterCount = [
    filters.vehicleMake,
    filters.showPredictions,
  ].filter(Boolean).length;

  const totalFilterCount = basicFilterCount + speedFilterCount + timeFilterCount + advancedFilterCount;

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
      vehicleMarking: null,
      showPredictions: null,
    });
  };

  const updateFilter = <K extends keyof MapFilters>(key: K, value: MapFilters[K]) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  return (
    <div
      className={cn(
        'bg-zinc-900/95 backdrop-blur-sm border border-zinc-800 rounded-xl shadow-xl overflow-hidden max-h-[80vh] flex flex-col',
        className
      )}
    >
      {/* Header */}
      <button
        className="w-full p-3 flex items-center justify-between hover:bg-zinc-800/50 transition-colors flex-shrink-0"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <Filter size={18} className="text-violet-500" />
          <span className="font-medium text-white">Filters</span>
          {totalFilterCount > 0 && (
            <span className="px-2 py-0.5 bg-violet-500/20 text-violet-400 text-xs rounded-full">
              {totalFilterCount}
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
        <div className="overflow-y-auto flex-1 border-t border-zinc-800">
          {/* Basic Filters Section */}
          <FilterSection title="Basic Filters" icon={AlertTriangle} badge={basicFilterCount} defaultOpen={true}>
            {/* Violation Type */}
            <FilterSelect
              options={VIOLATION_TYPES}
              value={filters.violationType}
              onChange={(v) => updateFilter('violationType', v as string | null)}
              icon={Car}
              label="Violation Type"
            />

            {/* Quick Toggles - Incident Type */}
            <div>
              <label className="text-xs text-zinc-400 mb-1.5 block">Incident Type</label>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => updateFilter('hasAlcohol', filters.hasAlcohol === true ? null : true)}
                  className={cn(
                    'px-2 py-1.5 rounded-lg text-xs font-medium transition-colors border',
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
                    'px-2 py-1.5 rounded-lg text-xs font-medium transition-colors border',
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
                    'px-2 py-1.5 rounded-lg text-xs font-medium transition-colors border',
                    filters.searchConducted === true
                      ? 'bg-purple-500/20 border-purple-500/50 text-purple-400'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600'
                  )}
                >
                  🔍 Search
                </button>
              </div>
            </div>

            {/* Vehicle Marking */}
            <div>
              <label className="text-xs text-zinc-400 mb-1.5 block">Police Vehicle</label>
              <div className="flex gap-1.5">
                <button
                  onClick={() => updateFilter('vehicleMarking', filters.vehicleMarking === 'marked' ? null : 'marked')}
                  className={cn(
                    'flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors border',
                    filters.vehicleMarking === 'marked'
                      ? 'bg-blue-500/20 border-blue-500/50 text-blue-400'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600'
                  )}
                >
                  🚔 Marked
                </button>
                <button
                  onClick={() => updateFilter('vehicleMarking', filters.vehicleMarking === 'unmarked' ? null : 'unmarked')}
                  className={cn(
                    'flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors border',
                    filters.vehicleMarking === 'unmarked'
                      ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600'
                  )}
                >
                  🚗 Unmarked
                </button>
              </div>
            </div>
          </FilterSection>

          {/* Speed Filters Section */}
          <FilterSection title="Speed Violations" icon={Gauge} badge={speedFilterCount} defaultOpen={false}>
            <QuickToggle
              isActive={filters.speedOnly === true}
              onClick={() => updateFilter('speedOnly', filters.speedOnly === true ? null : true)}
              icon={Gauge}
              label={filters.speedOnly ? 'Showing Speed Only' : 'Show Speed Violations Only'}
              activeColor="blue"
            />

            {filters.speedOnly && (
              <>
                <FilterSelect
                  options={DETECTION_METHODS}
                  value={filters.detectionMethod}
                  onChange={(v) => updateFilter('detectionMethod', v as string | null)}
                  icon={Radio}
                  label="Detection Method"
                />

                <FilterSelect
                  options={SPEED_OVER_OPTIONS}
                  value={filters.minSpeedOver}
                  onChange={(v) => updateFilter('minSpeedOver', v as number | null)}
                  icon={Zap}
                  label="Min Speed Over Limit"
                />

                <div>
                  <QuickToggle
                    isActive={filters.speedTrapsOnly === true}
                    onClick={() => updateFilter('speedTrapsOnly', filters.speedTrapsOnly === true ? null : true)}
                    icon={Target}
                    label={filters.speedTrapsOnly ? 'Showing Speed Traps' : 'Show Likely Speed Traps'}
                    activeColor="red"
                  />
                  <p className="text-xs text-zinc-500 mt-1">
                    Stationary radar/laser with high frequency
                  </p>
                </div>
              </>
            )}
          </FilterSection>

          {/* Time Filters Section */}
          <FilterSection title="Time & Date" icon={Clock} badge={timeFilterCount} defaultOpen={false}>
            <FilterSelect
              options={TIME_RANGES.map(r => ({
                value: r.value ? `${r.value[0]}-${r.value[1]}` : null,
                label: r.label,
              }))}
              value={filters.hourStart !== null ? `${filters.hourStart}-${filters.hourEnd}` : null}
              onChange={(v) => {
                if (!v) {
                  onFiltersChange({ ...filters, hourStart: null, hourEnd: null });
                } else {
                  const [start, end] = String(v).split('-').map(Number);
                  onFiltersChange({ ...filters, hourStart: start, hourEnd: end });
                }
              }}
              icon={Clock}
              label="Time of Day"
            />

            <FilterSelect
              options={DAYS_FILTER}
              value={filters.dayOfWeek}
              onChange={(v) => updateFilter('dayOfWeek', v as number | null)}
              icon={Calendar}
              label="Day of Week"
            />

            <FilterSelect
              options={YEARS_FILTER}
              value={filters.year}
              onChange={(v) => updateFilter('year', v as number | null)}
              icon={Calendar}
              label="Year"
            />
          </FilterSection>

          {/* Advanced Section */}
          <FilterSection title="Advanced" icon={Car} badge={advancedFilterCount} defaultOpen={false}>
            <FilterSelect
              options={vehicleMakeOptions}
              value={filters.vehicleMake}
              onChange={(v) => updateFilter('vehicleMake', v as string | null)}
              icon={Car}
              label="Vehicle Make"
            />

            <div>
              <QuickToggle
                isActive={filters.showPredictions === true}
                onClick={() => updateFilter('showPredictions', filters.showPredictions === true ? null : true)}
                icon="🔮"
                label={filters.showPredictions ? 'Prediction Heatmap ON' : 'Show Risk Prediction'}
                activeColor="purple"
              />
              <p className="text-xs text-zinc-500 mt-1">
                ML-based enforcement probability
              </p>
            </div>
          </FilterSection>

          {/* Clear Button & Legend */}
          <div className="p-3 border-t border-zinc-800">
            {totalFilterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="w-full mb-3"
              >
                <X size={14} className="mr-1" />
                Clear All Filters
              </Button>
            )}

            {/* Compact Legend */}
            <div className="text-xs">
              <p className="text-zinc-500 mb-1.5">Point Colors</p>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: POINT_COLORS.alcohol }} />
                  <span className="text-zinc-400">Alcohol</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: POINT_COLORS.accident }} />
                  <span className="text-zinc-400">Accident</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: POINT_COLORS.citation }} />
                  <span className="text-zinc-400">Citation</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: POINT_COLORS.warning }} />
                  <span className="text-zinc-400">Warning</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
