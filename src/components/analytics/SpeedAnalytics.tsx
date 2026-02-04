'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, Button } from '@/components/ui';
import { 
  Gauge, 
  Radio, 
  Zap, 
  Clock,
  Car,
  MapPin,
  TrendingUp,
  AlertTriangle,
  RefreshCw 
} from 'lucide-react';
import { TimeChart } from './TimeChart';
import { TopList } from './TopList';

interface SpeedStats {
  totalStops: number;
  byMethod: Array<{ method: string; count: number }>;
  byHour: Array<{ hour: number; count: number }>;
  byDay: Array<{ day: number; count: number }>;
  topLocations: Array<{ location: string; count: number }>;
  topVehicles: Array<{ make: string; count: number }>;
}

interface SpeedAnalyticsProps {
  className?: string;
}

const DETECTION_METHODS = [
  { value: 'all', label: 'All Methods', icon: Gauge },
  { value: 'radar', label: 'Radar', icon: Radio },
  { value: 'laser', label: 'Laser', icon: Zap },
  { value: 'vascar', label: 'VASCAR', icon: Clock },
  { value: 'patrol', label: 'Patrol', icon: Car },
];

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function SpeedAnalytics({ className }: SpeedAnalyticsProps) {
  const [stats, setStats] = useState<SpeedStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMethod, setSelectedMethod] = useState('all');
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams();
      params.set('statsOnly', 'true');
      if (selectedMethod !== 'all') {
        params.set('detectionMethod', selectedMethod);
      }
      
      const res = await fetch(`/api/analytics/speed?${params}`);
      if (!res.ok) throw new Error('Failed to fetch speed stats');
      
      const json = await res.json();
      if (json.success) {
        setStats(json.data);
      } else {
        throw new Error(json.error || 'Unknown error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }, [selectedMethod]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Format hourly data for chart (matches TimeChart interface)
  const hourlyData = stats?.byHour.map(h => ({
    label: `${h.hour}:00`,
    count: h.count,
  })) || [];

  // Format daily data for chart (matches TimeChart interface)
  const dailyData = stats?.byDay.map(d => ({
    label: DAY_NAMES[d.day].substring(0, 3),
    count: d.count,
  })) || [];

  // Calculate method percentages
  const methodTotal = stats?.byMethod.reduce((sum, m) => sum + m.count, 0) || 0;
  const methodData = stats?.byMethod.map(m => ({
    method: m.method,
    count: m.count,
    percentage: methodTotal > 0 ? ((m.count / methodTotal) * 100).toFixed(1) : '0',
  })) || [];

  const getMethodColor = (method: string) => {
    switch (method.toLowerCase()) {
      case 'radar': return 'text-blue-400';
      case 'laser': return 'text-red-400';
      case 'vascar': return 'text-yellow-400';
      case 'patrol': return 'text-green-400';
      case 'automated': return 'text-purple-400';
      default: return 'text-zinc-400';
    }
  };

  const getMethodIcon = (method: string) => {
    switch (method.toLowerCase()) {
      case 'radar': return Radio;
      case 'laser': return Zap;
      case 'vascar': return Clock;
      case 'patrol': return Car;
      default: return Gauge;
    }
  };

  return (
    <div className={className}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Gauge className="text-orange-500" />
            Speed Violation Analytics
          </h2>
          <p className="text-zinc-400 mt-1">
            Analysis of {stats?.totalStops.toLocaleString() || '...'} speed-related traffic stops
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchStats}
          disabled={isLoading}
        >
          <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
        </Button>
      </div>

      {/* Detection Method Filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        {DETECTION_METHODS.map(method => {
          const Icon = method.icon;
          return (
            <Button
              key={method.value}
              variant={selectedMethod === method.value ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setSelectedMethod(method.value)}
            >
              <Icon size={16} className="mr-1" />
              {method.label}
            </Button>
          );
        })}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
          <p className="text-red-400 flex items-center gap-2">
            <AlertTriangle size={16} />
            {error}
          </p>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Total Stops */}
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-zinc-400 text-sm">Total Speed Stops</p>
                <p className="text-2xl font-bold text-white">
                  {isLoading ? '...' : stats?.totalStops.toLocaleString()}
                </p>
              </div>
              <Gauge className="text-orange-500" size={32} />
            </div>
          </CardContent>
        </Card>

        {/* Detection Methods Breakdown */}
        {methodData.slice(0, 3).map(m => {
          const Icon = getMethodIcon(m.method);
          return (
            <Card key={m.method} className="bg-zinc-900/50 border-zinc-800">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-zinc-400 text-sm capitalize">{m.method}</p>
                    <p className="text-2xl font-bold text-white">
                      {m.count.toLocaleString()}
                    </p>
                    <p className={`text-sm ${getMethodColor(m.method)}`}>
                      {m.percentage}% of total
                    </p>
                  </div>
                  <Icon className={getMethodColor(m.method)} size={32} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Hourly Distribution */}
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-4">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Clock size={18} className="text-blue-400" />
              Speed Stops by Hour
            </h3>
            <TimeChart
              data={hourlyData}
              title=""
              showBreakdown={false}
            />
          </CardContent>
        </Card>

        {/* Daily Distribution */}
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-4">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <TrendingUp size={18} className="text-green-400" />
              Speed Stops by Day
            </h3>
            <TimeChart
              data={dailyData}
              title=""
              showBreakdown={false}
            />
          </CardContent>
        </Card>
      </div>

      {/* Detection Method Breakdown */}
      <Card className="bg-zinc-900/50 border-zinc-800 mb-6">
        <CardContent className="p-4">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Radio size={18} className="text-orange-400" />
            Detection Method Breakdown
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {methodData.map(m => {
              const Icon = getMethodIcon(m.method);
              return (
                <div 
                  key={m.method}
                  className="bg-zinc-800/50 rounded-lg p-4 text-center"
                >
                  <Icon className={`${getMethodColor(m.method)} mx-auto mb-2`} size={28} />
                  <p className="text-white font-semibold capitalize">{m.method}</p>
                  <p className="text-zinc-400 text-sm">{m.count.toLocaleString()}</p>
                  <div className="mt-2 bg-zinc-700 rounded-full h-2 overflow-hidden">
                    <div 
                      className="h-full bg-orange-500 transition-all duration-500"
                      style={{ width: `${m.percentage}%` }}
                    />
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">{m.percentage}%</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Top Lists Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Locations */}
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-4">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <MapPin size={18} className="text-red-400" />
              Top Speed Enforcement Areas
            </h3>
            <TopList
              title=""
              items={stats?.topLocations.map(l => ({
                name: l.location,
                count: l.count,
              })) || []}
              maxItems={8}
            />
          </CardContent>
        </Card>

        {/* Top Vehicles */}
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-4">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Car size={18} className="text-purple-400" />
              Most Cited Vehicle Makes
            </h3>
            <TopList
              title=""
              items={stats?.topVehicles.map(v => ({
                name: v.make,
                count: v.count,
              })) || []}
              maxItems={8}
            />
          </CardContent>
        </Card>
      </div>

      {/* Info Note */}
      <div className="mt-6 p-4 bg-zinc-800/30 rounded-lg border border-zinc-700">
        <p className="text-sm text-zinc-400">
          <span className="font-semibold text-zinc-300">Detection Methods:</span>{' '}
          <span className="text-blue-400">Radar</span> uses radio waves to measure speed,{' '}
          <span className="text-red-400">Laser</span> uses light pulses for precise targeting,{' '}
          <span className="text-yellow-400">VASCAR</span> calculates speed from timing between two points,{' '}
          <span className="text-green-400">Patrol</span> is officer observation or pacing.
        </p>
      </div>
    </div>
  );
}
