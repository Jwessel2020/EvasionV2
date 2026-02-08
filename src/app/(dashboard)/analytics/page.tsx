'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  MapProvider,
  BaseMap,
  PoliceStopsLayer,
  SpeedTrapLayer,
  MapFilterPanel,
  PatternMarkersLayer,
  MapControlBar,
  StopDetailsPopup,
  SpeedTrapPopup,
  MapLegend,
  SelectedPatternInfo,
  AddressSearch,
  type MapFilters,
  type StopDetails,
  type SpeedTrapDetails,
} from '@/components/map';
import { PredictionLayer } from '@/components/map/PredictionLayer';
import { AreaSelectionTool } from '@/components/map/AreaSelectionTool';
import { StatsCard, TimeChart, TopList, SpeedAnalytics, DrillDownPanel } from '@/components/analytics';
import { Button, Card, CardContent } from '@/components/ui';
import {
  Activity,
  Car,
  AlertTriangle,
  Search,
  Clock,
  MapPin,
  RefreshCw,
  Calendar,
  Minimize2,
} from 'lucide-react';

interface StatsData {
  overview: {
    totalStops: number;
    alcoholStops: number;
    accidentStops: number;
    searchStops: number;
    fatalStops: number;
    alcoholRate: string;
    accidentRate: string;
  };
  dateRange: {
    start: string;
    end: string;
  };
  peakTimes: {
    hour: number | null;
    hourLabel: string | null;
    day: string | null;
  };
  topLocations: Array<{ name: string; count: number }>;
  violationTypes: Array<{ type: string; count: number }>;
  vehicleMakes: Array<{ make: string; count: number }>;
}

interface TimePatternData {
  hour?: number;
  day?: number;
  label: string;
  shortLabel?: string;
  count: number;
  alcoholCount?: number;
  accidentCount?: number;
}

export default function AnalyticsPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [hourlyData, setHourlyData] = useState<TimePatternData[]>([]);
  const [dailyData, setDailyData] = useState<TimePatternData[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [showPoints, setShowPoints] = useState(true);
  const [showSpeedTraps, setShowSpeedTraps] = useState(true); // Show speed traps by default
  const [lowDetailMode, setLowDetailMode] = useState(false);
  const [showAllPoints, setShowAllPoints] = useState(false);
  const [selectedStop, setSelectedStop] = useState<StopDetails | null>(null);
  const [selectedTrap, setSelectedTrap] = useState<SpeedTrapDetails | null>(null);

  // Area selection state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedBounds, setSelectedBounds] = useState<[number, number, number, number] | null>(null);
  const [drillDownData, setDrillDownData] = useState<any | null>(null);
  const [isLoadingDrillDown, setIsLoadingDrillDown] = useState(false);
  const [drillDownError, setDrillDownError] = useState<string | null>(null);

  // Fullscreen map state
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);

  // ML Pattern state
  const [showPatterns, setShowPatterns] = useState(false);
  const [patterns, setPatterns] = useState<Array<{
    id: string;
    type: string;
    name: string;
    description: string;
    locationCount: number;
    style: { icon: string; color: string; borderColor: string };
  }>>([]);
  const [selectedPatternId, setSelectedPatternId] = useState<string | null>(null);
  
  // Map filters for points layer
  const [mapFilters, setMapFilters] = useState<MapFilters>({
    violationType: null,
    hasAlcohol: null,
    hasAccident: null,
    hourStart: null,
    hourEnd: null,
    year: null,
    speedOnly: null,
    detectionMethod: null,
    minSpeedOver: null,
    speedTrapsOnly: null,
    vehicleMake: null,
    dayOfWeek: null,
    searchConducted: null,
    vehicleMarking: null,
    showPredictions: null,
  });
  
  // Helper to safely fetch JSON
  const safeFetch = async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`API ${url} returned ${res.status}`);
      return null;
    }
    return res.json();
  };
  
  // Fetch all data
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    
    try {
      // Fetch stats
      const statsJson = await safeFetch('/api/analytics/stats');
      if (statsJson?.success) {
        setStats(statsJson.data);
      }
      
      // Fetch hourly patterns
      const hourlyJson = await safeFetch('/api/analytics/time-patterns?type=hourly');
      if (hourlyJson?.success) {
        setHourlyData(hourlyJson.data);
      }
      
      // Fetch daily patterns
      const dailyJson = await safeFetch('/api/analytics/time-patterns?type=daily');
      if (dailyJson?.success) {
        setDailyData(dailyJson.data);
      }

    } catch (error) {
      console.error('Error fetching analytics data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch ML patterns when enabled
  useEffect(() => {
    if (showPatterns && patterns.length === 0) {
      fetch('/api/insights/ml/patterns?summary=true')
        .then(res => res.json())
        .then(json => {
          if (json.success && json.data?.patterns) {
            setPatterns(json.data.patterns);
          }
        })
        .catch(err => {
          console.warn('Failed to load ML patterns:', err.message);
        });
    }
  }, [showPatterns, patterns.length]);

  // Handle Escape key to exit fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMapFullscreen) {
        setIsMapFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMapFullscreen]);

  // Fetch drill-down data when area is selected
  useEffect(() => {
    if (!selectedBounds) {
      setDrillDownData(null);
      setDrillDownError(null);
      return;
    }

    const controller = new AbortController();
    setIsLoadingDrillDown(true);
    setDrillDownError(null); // Clear previous errors

    // Build query params including current map filters
    const params = new URLSearchParams({
      bounds: selectedBounds.join(','),
    });

    // Apply map filters to drill-down query
    if (mapFilters.year) params.set('year', mapFilters.year.toString());
    if (mapFilters.speedOnly) params.set('speedOnly', 'true');
    if (mapFilters.detectionMethod) params.set('detectionMethod', mapFilters.detectionMethod);
    if (mapFilters.hasAlcohol !== null) params.set('hasAlcohol', mapFilters.hasAlcohol.toString());
    if (mapFilters.hasAccident !== null) params.set('hasAccident', mapFilters.hasAccident.toString());
    if (mapFilters.minSpeedOver !== null) params.set('minSpeedOver', mapFilters.minSpeedOver.toString());
    if (mapFilters.vehicleMake) params.set('vehicleMake', mapFilters.vehicleMake);
    if (mapFilters.searchConducted) params.set('searchConducted', 'true');

    fetch(`/api/analytics/area-drilldown?${params}`, { signal: controller.signal })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setDrillDownData(data.data);
          setDrillDownError(null);
        } else {
          // Show error to user
          setDrillDownError(data.error || 'Failed to load area analytics');
          setDrillDownData(null);
          console.error('API returned error:', data.error || 'Unknown error');
        }
        setIsLoadingDrillDown(false);
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          setDrillDownError('Failed to fetch area analytics. Please try again.');
          setDrillDownData(null);
          console.error('Failed to fetch drill-down data:', err);
          setIsLoadingDrillDown(false);
        }
      });

    return () => controller.abort();
  }, [selectedBounds, mapFilters]);

  const formatDateRange = (start: string, end: string) => {
    if (!start || !end) return 'N/A';
    const startDate = new Date(start);
    const endDate = new Date(end);
    return `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Police Activity Analytics</h1>
          <p className="text-zinc-400 mt-1">
            Historical traffic violation data analysis
            {stats?.dateRange && (
              <span className="text-zinc-500 ml-2">
                ({formatDateRange(stats.dateRange.start, stats.dateRange.end)})
              </span>
            )}
          </p>
        </div>
        <Button onClick={fetchData} disabled={isLoading}>
          <RefreshCw size={16} className={`mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Traffic Stops"
          value={stats?.overview.totalStops ?? '--'}
          icon={<Activity size={24} />}
          color="violet"
        />
        <StatsCard
          title="Alcohol-Related"
          value={stats?.overview.alcoholStops ?? '--'}
          subtitle={stats?.overview.alcoholRate}
          icon={<AlertTriangle size={24} />}
          color="red"
        />
        <StatsCard
          title="Accidents"
          value={stats?.overview.accidentStops ?? '--'}
          subtitle={stats?.overview.accidentRate}
          icon={<Car size={24} />}
          color="blue"
        />
        <StatsCard
          title="Searches Conducted"
          value={stats?.overview.searchStops ?? '--'}
          icon={<Search size={24} />}
          color="purple"
        />
      </div>

      {/* Peak Times */}
      {stats?.peakTimes && (
        <div className="grid sm:grid-cols-2 gap-4">
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-violet-500/20 flex items-center justify-center">
                  <Clock size={24} className="text-violet-500" />
                </div>
                <div>
                  <p className="text-sm text-zinc-400">Peak Hour</p>
                  <p className="text-2xl font-bold text-white">
                    {stats.peakTimes.hourLabel || '--'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-violet-500/20 flex items-center justify-center">
                  <Calendar size={24} className="text-violet-500" />
                </div>
                <div>
                  <p className="text-sm text-zinc-400">Peak Day</p>
                  <p className="text-2xl font-bold text-white">
                    {stats.peakTimes.day || '--'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Map Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <MapPin size={20} className="text-violet-500" />
            Police Activity Map
          </h2>
          <MapControlBar
            showPoints={showPoints}
            onTogglePoints={() => setShowPoints(!showPoints)}
            showAllPoints={showAllPoints}
            onToggleAllPoints={() => {
              setShowAllPoints(!showAllPoints);
              if (!showAllPoints) setLowDetailMode(false);
            }}
            showSpeedTraps={showSpeedTraps}
            onToggleSpeedTraps={() => setShowSpeedTraps(!showSpeedTraps)}
            selectionMode={selectionMode}
            onToggleSelectionMode={() => {
              setSelectionMode(!selectionMode);
              if (selectionMode) {
                setSelectedBounds(null);
                setDrillDownData(null);
                setDrillDownError(null);
              }
            }}
            showPatterns={showPatterns}
            onTogglePatterns={() => setShowPatterns(!showPatterns)}
            patterns={patterns}
            selectedPatternId={selectedPatternId}
            onSelectPattern={setSelectedPatternId}
            isFullscreen={isMapFullscreen}
            onToggleFullscreen={() => setIsMapFullscreen(!isMapFullscreen)}
          />
        </div>

        {/* Fullscreen backdrop */}
        {isMapFullscreen && (
          <div
            className="fixed inset-0 bg-black/80 z-40"
            onClick={() => setIsMapFullscreen(false)}
          />
        )}

        {/* Map with filter panel */}
        <div className={`rounded-xl overflow-hidden border border-zinc-800 relative transition-all duration-300 ${
          isMapFullscreen
            ? 'fixed inset-4 z-50'
            : 'h-[750px]'
        }`}>
          {/* Fullscreen close button */}
          {isMapFullscreen && (
            <button
              onClick={() => setIsMapFullscreen(false)}
              className="absolute top-4 right-4 z-50 p-2 bg-zinc-900/90 hover:bg-zinc-800 rounded-lg border border-zinc-700 transition-colors"
              title="Exit fullscreen (Esc)"
            >
              <Minimize2 size={20} className="text-white" />
            </button>
          )}
          <MapProvider>
            <BaseMap
              initialCenter={[-77.1, 39.05]} // Maryland / Montgomery County area
              initialZoom={10}
              className="w-full h-full"
            >
              {/* Police stops with clustering */}
              <PoliceStopsLayer
                visible={showPoints}
                lowDetailMode={lowDetailMode}
                showAllPoints={showAllPoints}
                filters={mapFilters}
                onStopClick={(props) => setSelectedStop(props as StopDetails)}
              />

              {/* Speed Trap markers */}
              <SpeedTrapLayer
                visible={showSpeedTraps}
                year={mapFilters.year}
                minStops={5}
                onTrapClick={(props) => {
                  setSelectedTrap(props as SpeedTrapDetails);
                  setSelectedStop(null);
                }}
              />

              {/* ML Risk Prediction heatmap */}
              <PredictionLayer
                visible={mapFilters.showPredictions === true}
                hour={mapFilters.hourStart}
                day={mapFilters.dayOfWeek}
              />

              {/* ML Pattern markers */}
              <PatternMarkersLayer
                visible={showPatterns}
                selectedPatternId={selectedPatternId}
                onPatternLocationClick={() => {
                  // TODO: Show pattern location details
                }}
              />

              {/* Area selection tool */}
              {selectionMode && (
                <AreaSelectionTool
                  onAreaSelected={(bounds) => {
                    setSelectedBounds(bounds);
                    setSelectedStop(null); // Close other popups
                    setSelectedTrap(null);
                  }}
                  onClearSelection={() => setSelectedBounds(null)}
                />
              )}
            </BaseMap>

            {/* Address Search */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 w-80">
              <AddressSearch placeholder="Search address..." />
            </div>
          </MapProvider>
          
          {/* Filter Panel */}
          <MapFilterPanel
            filters={mapFilters}
            onFiltersChange={setMapFilters}
            className="absolute top-4 left-4 w-64"
            vehicleMakes={stats?.vehicleMakes || []}
          />

          {/* Selected Pattern Info */}
          {selectedPatternId && showPatterns && (
            <SelectedPatternInfo
              pattern={patterns.find(p => p.id === selectedPatternId) || null}
              onClose={() => setSelectedPatternId(null)}
            />
          )}

          {/* Selected Stop Details */}
          <StopDetailsPopup
            stop={selectedStop}
            onClose={() => setSelectedStop(null)}
          />
          
          {/* Selected Speed Trap Details */}
          <SpeedTrapPopup
            trap={selectedTrap}
            onClose={() => setSelectedTrap(null)}
          />
          
          {/* Error Message */}
          {drillDownError && (
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 max-w-md w-full mx-4">
              <div className="bg-red-900/95 backdrop-blur-sm border border-red-700 rounded-xl p-4 shadow-2xl">
                <div className="flex items-start gap-3">
                  <AlertTriangle size={24} className="text-red-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-semibold text-white mb-1">Area Analysis Error</h4>
                    <p className="text-sm text-red-200 mb-3">{drillDownError}</p>
                    <button
                      onClick={() => {
                        setDrillDownError(null);
                        setSelectedBounds(null);
                      }}
                      className="px-3 py-1.5 bg-red-800 hover:bg-red-700 text-white text-sm rounded-lg transition-colors"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Map Legend */}
          <MapLegend />
        </div>
      </div>

      {/* Time Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        <TimeChart
          data={hourlyData}
          title="Stops by Hour of Day"
          showBreakdown={false}
        />
        <TimeChart
          data={dailyData.map(d => ({ ...d, label: d.shortLabel || d.label }))}
          title="Stops by Day of Week"
          showBreakdown={false}
        />
      </div>

      {/* Top Lists */}
      <div className="grid md:grid-cols-3 gap-6">
        <TopList
          title="Top Locations (Districts)"
          items={stats?.topLocations.map(l => ({ name: l.name, count: l.count })) ?? []}
          maxItems={7}
        />
        <TopList
          title="Violation Types"
          items={stats?.violationTypes.map(v => ({ name: v.type, count: v.count })) ?? []}
          maxItems={7}
        />
        <TopList
          title="Vehicle Makes"
          items={stats?.vehicleMakes.map(v => ({ name: v.make, count: v.count })) ?? []}
          maxItems={7}
        />
      </div>

      {/* Speed Violation Analytics Section */}
      <div className="border-t border-zinc-800 pt-8">
        <SpeedAnalytics />
      </div>

      {/* Data Notice */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 text-sm text-zinc-400">
        <p>
          <strong className="text-zinc-300">Data Source:</strong> Maryland State Police Traffic Violations Database.
          This data is used for analytical purposes to identify traffic patterns and improve road safety awareness.
          Historical data may not reflect current enforcement patterns.
        </p>
      </div>

      {/* Drill-down panel */}
      {drillDownData && (
        <DrillDownPanel
          data={drillDownData}
          isLoading={isLoadingDrillDown}
          bounds={selectedBounds}
          onClose={() => {
            setDrillDownData(null);
            setSelectedBounds(null);
            setSelectionMode(false);
            setDrillDownError(null);
          }}
        />
      )}
    </div>
  );
}
