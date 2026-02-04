'use client';

import { useState, useEffect, useCallback } from 'react';
import { MapProvider, BaseMap, HeatmapLayer, PoliceStopsLayer, MapFilterPanel, type MapFilters } from '@/components/map';
import { StatsCard, TimeChart, TopList, SpeedAnalytics } from '@/components/analytics';
import { Button, Card, CardContent } from '@/components/ui';
import {
  Activity,
  Car,
  AlertTriangle,
  Search,
  Clock,
  MapPin,
  RefreshCw,
  Layers,
  Calendar,
  CircleDot,
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
  const [heatmapData, setHeatmapData] = useState<GeoJSON.FeatureCollection | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showPoints, setShowPoints] = useState(true);
  const [lowDetailMode, setLowDetailMode] = useState(false);
  const [showAllPoints, setShowAllPoints] = useState(false);
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [selectedStop, setSelectedStop] = useState<Record<string, unknown> | null>(null);
  
  // Map filters for points layer
  const [mapFilters, setMapFilters] = useState<MapFilters>({
    violationType: null,
    hasAlcohol: null,
    hasAccident: null,
    hourStart: null,
    hourEnd: null,
    speedOnly: null,
    detectionMethod: null,
    minSpeedOver: null,
    dayOfWeek: null,
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
      
      // Fetch heatmap data
      await fetchHeatmapData();
      
    } catch (error) {
      console.error('Error fetching analytics data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  // Fetch heatmap data with filters
  const fetchHeatmapData = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (selectedHour !== null) {
        params.set('hourStart', selectedHour.toString());
        params.set('hourEnd', selectedHour.toString());
      }
      if (selectedDay !== null) {
        params.set('dayOfWeek', selectedDay.toString());
      }
      
      const json = await safeFetch(`/api/analytics/heatmap?${params}`);
      if (json?.success) {
        setHeatmapData(json.data);
      }
    } catch (error) {
      console.error('Error fetching heatmap:', error);
    }
  }, [selectedHour, selectedDay]);
  
  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  // Refetch heatmap when filters change
  useEffect(() => {
    fetchHeatmapData();
  }, [fetchHeatmapData]);
  
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
          color="orange"
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
                <div className="w-12 h-12 rounded-lg bg-orange-500/20 flex items-center justify-center">
                  <Clock size={24} className="text-orange-500" />
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
                <div className="w-12 h-12 rounded-lg bg-orange-500/20 flex items-center justify-center">
                  <Calendar size={24} className="text-orange-500" />
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
            <MapPin size={20} className="text-orange-500" />
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
              variant={showHeatmap ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setShowHeatmap(!showHeatmap)}
            >
              <Activity size={16} className="mr-1" />
              Heatmap
            </Button>
          </div>
        </div>
        
        {/* Map with filter panel */}
        <div className="h-[600px] rounded-xl overflow-hidden border border-zinc-800 relative">
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
              
              {/* Heatmap overlay */}
              <HeatmapLayer
                data={heatmapData}
                visible={showHeatmap}
                radius={25}
                intensity={1.5}
                opacity={0.6}
              />
            </BaseMap>
          </MapProvider>
          
          {/* Filter Panel */}
          <MapFilterPanel
            filters={mapFilters}
            onFiltersChange={setMapFilters}
            className="absolute top-4 left-4 w-64"
          />
          
          {/* Selected Stop Details */}
          {selectedStop && (
            <div className="absolute bottom-4 left-4 right-4 max-w-md bg-zinc-900/95 backdrop-blur-sm border border-zinc-800 rounded-xl p-4 shadow-xl">
              <div className="flex items-start justify-between mb-2">
                <h4 className="font-semibold text-white">Traffic Stop Details</h4>
                <button 
                  onClick={() => setSelectedStop(null)}
                  className="text-zinc-400 hover:text-white"
                >
                  ×
                </button>
              </div>
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
                    <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 text-xs rounded">Accident</span>
                  </div>
                ) : null}
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
                  <span className="w-3 h-3 rounded-full bg-[#f97316]" />
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
    </div>
  );
}
