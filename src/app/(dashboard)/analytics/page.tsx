'use client';

import { useState, useEffect, useCallback } from 'react';
import { MapProvider, BaseMap, PoliceStopsLayer, SpeedTrapLayer, MapFilterPanel, PatternMarkersLayer, type MapFilters } from '@/components/map';
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
  CircleDot,
  Target,
  X,
  Focus,
  BrainCircuit,
  ChevronDown,
  Maximize2,
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
  const [selectedStop, setSelectedStop] = useState<Record<string, unknown> | null>(null);
  const [selectedTrap, setSelectedTrap] = useState<Record<string, unknown> | null>(null);

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
  const [patternDropdownOpen, setPatternDropdownOpen] = useState(false);
  
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
          <div className="flex items-center gap-2">
            <Button
              variant={showPoints ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setShowPoints(!showPoints)}
            >
              <CircleDot size={16} className="mr-1" />
              Points
            </Button>
            <Button
              variant={showAllPoints ? 'danger' : 'outline'}
              size="sm"
              onClick={() => {
                setShowAllPoints(!showAllPoints);
                if (!showAllPoints) setLowDetailMode(false); // Can't have both
              }}
              title="Show all points without clustering (may be slow)"
            >
              <MapPin size={16} className="mr-1" />
              {showAllPoints ? 'All Points' : 'Clustered'}
            </Button>
            <Button
              variant={showSpeedTraps ? 'danger' : 'outline'}
              size="sm"
              onClick={() => setShowSpeedTraps(!showSpeedTraps)}
              title="Show identified speed trap locations"
            >
              <Target size={16} className="mr-1" />
              {showSpeedTraps ? 'Speed Traps' : 'Speed Traps'}
            </Button>
            <Button
              variant={selectionMode ? 'primary' : 'outline'}
              size="sm"
              onClick={() => {
                setSelectionMode(!selectionMode);
                if (selectionMode) {
                  // Clear selection when exiting mode
                  setSelectedBounds(null);
                  setDrillDownData(null);
                  setDrillDownError(null);
                }
              }}
              title="Click and drag to draw a rectangle on the map to analyze violations in that area"
            >
              <Focus size={16} className="mr-1" />
              {selectionMode ? 'Exit Analysis' : 'Analyze Area'}
            </Button>

            {/* ML Patterns dropdown */}
            <div className="relative">
              <Button
                variant={showPatterns ? 'primary' : 'outline'}
                size="sm"
                onClick={() => {
                  if (!showPatterns) {
                    setShowPatterns(true);
                    setPatternDropdownOpen(true);
                  } else {
                    setPatternDropdownOpen(!patternDropdownOpen);
                  }
                }}
              >
                <BrainCircuit size={16} className="mr-1" />
                ML Patterns
                <ChevronDown size={14} className={`ml-1 transition-transform ${patternDropdownOpen ? 'rotate-180' : ''}`} />
              </Button>

              {/* Pattern selector dropdown */}
              {patternDropdownOpen && showPatterns && (
                <div className="absolute top-full right-0 mt-2 w-80 bg-zinc-900/95 backdrop-blur-sm rounded-lg border border-zinc-700 shadow-xl z-50 max-h-96 overflow-y-auto">
                  <div className="p-3 border-b border-zinc-700">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-white">Discovered Patterns</span>
                      <button
                        onClick={() => {
                          setShowPatterns(false);
                          setSelectedPatternId(null);
                          setPatternDropdownOpen(false);
                        }}
                        className="text-xs text-zinc-400 hover:text-white"
                      >
                        Clear
                      </button>
                    </div>
                    <p className="text-xs text-zinc-500 mt-1">
                      Select a pattern to see its locations on the map
                    </p>
                  </div>

                  {patterns.length === 0 ? (
                    <div className="p-4 text-center text-zinc-400 text-sm">
                      Loading patterns...
                    </div>
                  ) : (
                    <div className="p-2">
                      {/* Group by pattern type */}
                      {['time_cluster', 'method_zone', 'day_pattern'].map(type => {
                        const typePatterns = patterns.filter(p => p.type === type);
                        if (typePatterns.length === 0) return null;

                        const typeLabels: Record<string, string> = {
                          'time_cluster': 'Time Clusters',
                          'method_zone': 'Detection Method Zones',
                          'day_pattern': 'Day Patterns',
                        };

                        return (
                          <div key={type} className="mb-2">
                            <div className="text-xs text-zinc-500 px-2 py-1 uppercase tracking-wide">
                              {typeLabels[type] || type}
                            </div>
                            {typePatterns.map(pattern => (
                              <button
                                key={pattern.id}
                                onClick={() => {
                                  setSelectedPatternId(selectedPatternId === pattern.id ? null : pattern.id);
                                }}
                                className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                                  selectedPatternId === pattern.id
                                    ? 'bg-zinc-700'
                                    : 'hover:bg-zinc-800'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <span
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: pattern.style.color }}
                                  />
                                  <span className="text-sm text-white flex-1 truncate">
                                    {pattern.name}
                                  </span>
                                  <span className="text-xs text-zinc-400">
                                    {pattern.locationCount}
                                  </span>
                                </div>
                                <p className="text-xs text-zinc-500 mt-0.5 pl-5 truncate">
                                  {pattern.description}
                                </p>
                              </button>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Fullscreen toggle */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsMapFullscreen(!isMapFullscreen)}
              title={isMapFullscreen ? 'Exit fullscreen' : 'Fullscreen map'}
            >
              {isMapFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </Button>
          </div>
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
                onStopClick={(props) => setSelectedStop(props)}
              />

              {/* Speed Trap markers */}
              <SpeedTrapLayer
                visible={showSpeedTraps}
                year={mapFilters.year}
                minStops={5}
                onTrapClick={(props) => {
                  setSelectedTrap(props);
                  setSelectedStop(null); // Close other popup
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
                onPatternLocationClick={(loc, pattern) => {
                  console.log('Pattern location clicked:', loc, pattern);
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
            <div className="absolute top-4 right-4 bg-zinc-900/95 backdrop-blur-sm rounded-lg p-3 border border-zinc-700 max-w-xs z-10">
              {(() => {
                const pattern = patterns.find(p => p.id === selectedPatternId);
                if (!pattern) return null;
                return (
                  <>
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: pattern.style.color }}
                      />
                      <span className="text-sm font-medium text-white">{pattern.name}</span>
                      <button
                        onClick={() => setSelectedPatternId(null)}
                        className="ml-auto p-1 hover:bg-zinc-700 rounded"
                      >
                        <X size={14} className="text-zinc-400" />
                      </button>
                    </div>
                    <p className="text-xs text-zinc-400 mb-2">{pattern.description}</p>
                    <div className="flex items-center gap-4 text-xs">
                      <span className="text-zinc-500">
                        <span className="text-white font-medium">{pattern.locationCount}</span> locations
                      </span>
                      <span className="text-zinc-500">
                        Type: <span className="text-zinc-300">{pattern.type.replace('_', ' ')}</span>
                      </span>
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {/* Selected Stop Details */}
          {selectedStop && (
            <div className="absolute bottom-4 left-4 right-4 max-w-md bg-zinc-900/95 backdrop-blur-sm border border-zinc-800 rounded-xl p-4 shadow-xl">
              <div className="flex items-start justify-between mb-2">
                <h4 className="font-semibold text-white">Traffic Stop Details</h4>
                <button
                  onClick={() => setSelectedStop(null)}
                  className="text-zinc-400 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Description */}
              {selectedStop.description && (
                <div className="mb-3 pb-3 border-b border-zinc-700">
                  <p className="text-sm text-zinc-300 leading-relaxed">
                    {String(selectedStop.description)}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-zinc-400">Type:</span>
                  <span className="ml-2 text-white">{String(selectedStop.violationType)}</span>
                </div>
                {selectedStop.vehicle ? (
                  <div>
                    <span className="text-zinc-400">Vehicle:</span>
                    <span className="ml-2 text-white">{String(selectedStop.vehicle)}</span>
                  </div>
                ) : null}
                {selectedStop.subAgency ? (
                  <div className="col-span-2">
                    <span className="text-zinc-400">District:</span>
                    <span className="ml-2 text-white">{String(selectedStop.subAgency)}</span>
                  </div>
                ) : null}
                {selectedStop.alcohol ? (
                  <div className="col-span-2">
                    <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded">Alcohol Related</span>
                  </div>
                ) : null}
                {selectedStop.accident ? (
                  <div className="col-span-2">
                    <span className="px-2 py-0.5 bg-violet-500/20 text-violet-400 text-xs rounded">Accident</span>
                  </div>
                ) : null}
              </div>
            </div>
          )}
          
          {/* Selected Speed Trap Details */}
          {selectedTrap && (
            <div className="absolute bottom-4 left-4 right-4 max-w-md bg-zinc-900/95 backdrop-blur-sm border border-red-800/50 rounded-xl p-4 shadow-xl">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Target className="text-red-500" size={20} />
                  <h4 className="font-semibold text-white">Speed Trap Location</h4>
                </div>
                <button 
                  onClick={() => setSelectedTrap(null)}
                  className="text-zinc-400 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-zinc-800/50 rounded-lg p-2.5">
                  <p className="text-zinc-400 text-xs mb-1">Trap Score</p>
                  <p className="text-2xl font-bold text-red-500">
                    {selectedTrap.trapScore ? Number(selectedTrap.trapScore).toFixed(0) : 'N/A'}
                  </p>
                </div>
                <div className="bg-zinc-800/50 rounded-lg p-2.5">
                  <p className="text-zinc-400 text-xs mb-1">Total Stops</p>
                  <p className="text-2xl font-bold text-white">
                    {selectedTrap.stopCount ? Number(selectedTrap.stopCount) : 'N/A'}
                  </p>
                </div>
                <div className="bg-zinc-800/50 rounded-lg p-2.5">
                  <p className="text-zinc-400 text-xs mb-1">Unique Days</p>
                  <p className="text-lg font-semibold text-white">
                    {selectedTrap.uniqueDays ? Number(selectedTrap.uniqueDays) : 'N/A'}
                  </p>
                </div>
                <div className="bg-zinc-800/50 rounded-lg p-2.5">
                  <p className="text-zinc-400 text-xs mb-1">Avg. Speed Over</p>
                  <p className="text-lg font-semibold text-violet-400">
                    {selectedTrap.avgSpeedOver ? `+${Number(selectedTrap.avgSpeedOver)} mph` : 'N/A'}
                  </p>
                </div>
                {selectedTrap.maxSpeedOver && (
                  <div className="bg-zinc-800/50 rounded-lg p-2.5">
                    <p className="text-zinc-400 text-xs mb-1">Max Speed Over</p>
                    <p className="text-lg font-semibold text-red-400">
                      +{Number(selectedTrap.maxSpeedOver)} mph
                    </p>
                  </div>
                )}
                {selectedTrap.primaryMethod && (
                  <div className="bg-zinc-800/50 rounded-lg p-2.5">
                    <p className="text-zinc-400 text-xs mb-1">Detection</p>
                    <p className="text-lg font-semibold text-white capitalize">
                      {String(selectedTrap.primaryMethod)}
                    </p>
                  </div>
                )}
                {selectedTrap.location && (
                  <div className="col-span-2 bg-zinc-800/50 rounded-lg p-2.5">
                    <p className="text-zinc-400 text-xs mb-1">Location</p>
                    <p className="text-white text-sm">
                      {String(selectedTrap.location)}
                    </p>
                  </div>
                )}
              </div>
              <p className="text-xs text-zinc-500 mt-3">
                ⚠️ High speed enforcement area - {selectedTrap.stopCount || 0} stops over {selectedTrap.uniqueDays || 0} days
              </p>
            </div>
          )}
          
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
          <div className="absolute bottom-4 right-4 bg-zinc-900/90 backdrop-blur-sm border border-zinc-800 rounded-lg p-3 text-xs">
            <p className="text-zinc-400 mb-2 font-medium">Clusters → Individual at zoom 13+</p>
            <div className="space-y-1.5">
              <p className="text-zinc-500 text-[10px] uppercase tracking-wide">Cluster Size</p>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-[#22d3ee]" />
                  <span className="text-zinc-400">10</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-[#8b5cf6]" />
                  <span className="text-zinc-400">100</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-[#a855f7]" />
                  <span className="text-zinc-400">500</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-[#ef4444]" />
                  <span className="text-zinc-400">1K+</span>
                </div>
              </div>
            </div>
          </div>
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
