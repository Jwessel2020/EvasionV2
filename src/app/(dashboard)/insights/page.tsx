'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Button } from '@/components/ui';
import {
  Clock,
  MapPin,
  Gauge,
  Route,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Calendar,
  Target,
  Zap,
  Shield,
  Info,
  Brain,
  Sparkles,
} from 'lucide-react';
import { LocationProfile, PatternDiscovery, AnomalyList } from '@/components/insights';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Cell,
  PieChart,
  Pie,
  Legend,
} from 'recharts';
import { cn } from '@/lib/utils';

interface TimePatternData {
  quotaPattern: {
    insight: string;
    isSignificant: boolean;
    endOfMonthEffect: number;
    data: Array<{ dayOfMonth: number; count: number; relativeRate: number }>;
  };
  dayOfWeek: {
    insight: string;
    highestDay: string;
    lowestDay: string;
    data: Array<{ day: string; dayNum: number; count: number; avgSpeedOver: number; relativeRate: number }>;
  };
  hourlyPattern: {
    insight: string;
    peakHours: number[];
    data: Array<{ hour: number; label: string; count: number; riskLevel: string }>;
  };
  seasonal: {
    insight: string;
    highestMonth: string;
    lowestMonth: string;
    data: Array<{ month: string; monthNum: number; count: number; relativeRate: number }>;
  };
  weekendVsWeekday: {
    insight: string;
    weekdayAvgPerDay: number;
    weekendAvgPerDay: number;
    difference: number;
  };
}

interface ThresholdData {
  overall: {
    insight: string;
    totalSpeedViolations: number;
    averageSpeedOver: number;
    medianSpeedOver: number;
    percentiles: { p10: number; p25: number; p50: number; p75: number; p90: number };
    distribution: Array<{ bucket: string; count: number; percentage: number; cumulativePercentage: number }>;
  };
  byMethod: {
    insight: string;
    methods: Array<{
      method: string;
      count: number;
      avgSpeedOver: number;
      medianSpeedOver: number;
      minTypical: number;
      strictness: string;
    }>;
  };
  recommendations: {
    generalThreshold: number;
    safeBuffer: number;
    riskLevels: Array<{ speedOver: string; risk: string; description: string }>;
  };
}

interface HotspotData {
  hotspots: Array<{
    id: string;
    lat: number;
    lng: number;
    totalStops: number;
    uniqueDays: number;
    frequencyScore: number;
    avgSpeedOver: number;
    dominantMethod: string;
    severity: string;
    insight: string;
  }>;
  summary: {
    totalHotspots: number;
    criticalCount: number;
    highCount: number;
    insight: string;
  };
}

interface CorridorData {
  corridors: Array<{
    id: string;
    totalStops: number;
    stopsPerMile: number;
    riskLevel: string;
    dominantMethod: string;
    insight: string;
    hotWindows: Array<{ day: string; hours: string; riskMultiplier: number }>;
  }>;
  summary: {
    totalCorridors: number;
    criticalCount: number;
    highRiskCount: number;
    insight: string;
  };
}

const COLORS = {
  primary: '#a855f7',
  secondary: '#8b5cf6',
  success: '#22c55e',
  warning: '#facc15',
  danger: '#ef4444',
  info: '#3b82f6',
};

const RISK_COLORS: Record<string, string> = {
  very_low: COLORS.success,
  low: '#86efac',
  moderate: COLORS.warning,
  high: COLORS.primary,
  very_high: COLORS.danger,
};

export default function InsightsPage() {
  const [timePatterns, setTimePatterns] = useState<TimePatternData | null>(null);
  const [thresholds, setThresholds] = useState<ThresholdData | null>(null);
  const [hotspots, setHotspots] = useState<HotspotData | null>(null);
  const [corridors, setCorridors] = useState<CorridorData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ml-patterns' | 'ml-anomalies' | 'time' | 'location' | 'threshold' | 'routes'>('ml-patterns');
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [timePatternsRes, thresholdsRes, hotspotsRes, corridorsRes] = await Promise.all([
        fetch('/api/insights/time-patterns').then(r => r.json()),
        fetch('/api/insights/thresholds').then(r => r.json()),
        fetch('/api/insights/hotspots?limit=20').then(r => r.json()),
        fetch('/api/insights/route-risk?limit=15').then(r => r.json()),
      ]);

      if (timePatternsRes.success) setTimePatterns(timePatternsRes.data);
      if (thresholdsRes.success) setThresholds(thresholdsRes.data);
      if (hotspotsRes.success) setHotspots(hotspotsRes.data);
      if (corridorsRes.success) setCorridors(corridorsRes.data);
    } catch (error) {
      console.error('Error fetching insights:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const InsightCard = ({ icon: Icon, title, insight, color = 'orange' }: {
    icon: React.ElementType;
    title: string;
    insight: string;
    color?: string;
  }) => (
    <div className={`bg-zinc-800/50 border border-zinc-700 rounded-xl p-4`}>
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-lg bg-${color}-500/20 flex items-center justify-center flex-shrink-0`}>
          <Icon size={20} className={`text-${color}-500`} />
        </div>
        <div>
          <h4 className="text-sm font-medium text-zinc-400 mb-1">{title}</h4>
          <p className="text-white">{insight}</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Zap className="text-purple-500" />
            Speed Trap Intelligence
          </h1>
          <p className="text-zinc-400 mt-1">
            Driver-focused insights from traffic enforcement data
          </p>
        </div>
        <Button onClick={fetchData} disabled={isLoading}>
          <RefreshCw size={16} className={`mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-purple-500/10 to-transparent border-purple-500/30">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <Clock className="text-purple-400" size={24} />
              <div>
                <p className="text-xs text-zinc-400">Peak Enforcement</p>
                <p className="text-lg font-bold text-white">
                  {timePatterns?.hourlyPattern.peakHours.slice(0, 2).map(h => `${h}:00`).join(', ') || '--'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-red-500/10 to-transparent border-red-500/30">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <Target className="text-red-400" size={24} />
              <div>
                <p className="text-xs text-zinc-400">Speed Trap Hotspots</p>
                <p className="text-lg font-bold text-white">
                  {hotspots?.summary.criticalCount || 0} critical
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-violet-500/10 to-transparent border-violet-500/30">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <Gauge className="text-violet-400" size={24} />
              <div>
                <p className="text-xs text-zinc-400">Typical Threshold</p>
                <p className="text-lg font-bold text-white">
                  {thresholds?.overall.medianSpeedOver || '--'} mph over
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-500/10 to-transparent border-green-500/30">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <Shield className="text-green-400" size={24} />
              <div>
                <p className="text-xs text-zinc-400">Safe Buffer</p>
                <p className="text-lg font-bold text-white">
                  Under {thresholds?.recommendations.generalThreshold || '--'} over
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2 border-b border-zinc-800 pb-2">
        {/* ML Tabs */}
        <div className="flex gap-2 border-r border-zinc-700 pr-2 mr-2">
          {[
            { id: 'ml-patterns', label: 'ML Patterns', icon: Brain },
            { id: 'ml-anomalies', label: 'Anomalies', icon: Sparkles },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                activeTab === tab.id
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              )}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>
        {/* Legacy SQL Tabs */}
        {[
          { id: 'time', label: 'Time Patterns', icon: Clock },
          { id: 'threshold', label: 'Speed Thresholds', icon: Gauge },
          { id: 'location', label: 'Hotspot Locations', icon: MapPin },
          { id: 'routes', label: 'High-Risk Roads', icon: Route },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              activeTab === tab.id
                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            )}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ML Patterns Tab */}
      {activeTab === 'ml-patterns' && (
        <div className="space-y-6">
          {/* ML Section Header */}
          <div className="bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-blue-500/10 border border-blue-500/30 rounded-xl p-6">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                <Brain size={28} className="text-blue-500" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-2">ML-Discovered Patterns</h3>
                <p className="text-zinc-300">
                  Machine learning analysis of historical enforcement data reveals hidden patterns
                  like time clusters, detection method zones, and quota effects that simple aggregations miss.
                </p>
              </div>
            </div>
          </div>

          {/* Pattern Discovery Component */}
          <PatternDiscovery onLocationClick={setSelectedLocation} />
        </div>
      )}

      {/* ML Anomalies Tab */}
      {activeTab === 'ml-anomalies' && (
        <div className="space-y-6">
          {/* Anomalies Section Header */}
          <div className="bg-gradient-to-r from-yellow-500/10 via-amber-500/10 to-red-500/10 border border-yellow-500/30 rounded-xl p-6">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-xl bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
                <Sparkles size={28} className="text-yellow-500" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-2">Statistical Anomalies</h3>
                <p className="text-zinc-300">
                  Statistically significant deviations from expected enforcement patterns.
                  These anomalies are detected using z-score analysis and may indicate recent
                  changes in enforcement behavior.
                </p>
              </div>
            </div>
          </div>

          {/* Anomaly List Component */}
          <AnomalyList onLocationClick={setSelectedLocation} />
        </div>
      )}

      {/* Location Profile Modal */}
      {selectedLocation && (
        <LocationProfile
          gridId={selectedLocation}
          onClose={() => setSelectedLocation(null)}
        />
      )}

      {/* Time Patterns Tab */}
      {activeTab === 'time' && timePatterns && (
        <div className="space-y-6">
          {/* Key Insights */}
          <div className="grid md:grid-cols-2 gap-4">
            <InsightCard
              icon={Calendar}
              title="End of Month Effect"
              insight={timePatterns.quotaPattern.insight}
              color="purple"
            />
            <InsightCard
              icon={TrendingUp}
              title="Day of Week"
              insight={timePatterns.dayOfWeek.insight}
              color="orange"
            />
          </div>

          {/* Day of Month Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar size={18} className="text-purple-500" />
                Enforcement by Day of Month
                {timePatterns.quotaPattern.isSignificant && (
                  <span className="ml-2 px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full">
                    Quota Pattern Detected
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={timePatterns.quotaPattern.data}>
                    <XAxis
                      dataKey="dayOfMonth"
                      tick={{ fill: '#a1a1aa', fontSize: 11 }}
                      axisLine={{ stroke: '#3f3f46' }}
                    />
                    <YAxis
                      tick={{ fill: '#a1a1aa', fontSize: 11 }}
                      axisLine={{ stroke: '#3f3f46' }}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46' }}
                      labelStyle={{ color: '#fff' }}
                    />
                    <Bar dataKey="count" fill={COLORS.primary}>
                      {timePatterns.quotaPattern.data.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.dayOfMonth >= 25 ? COLORS.danger : COLORS.primary}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-zinc-500 mt-2 flex items-center gap-1">
                <Info size={12} />
                Red bars indicate end-of-month period (days 25-31)
              </p>
            </CardContent>
          </Card>

          {/* Day of Week + Hourly Charts */}
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Enforcement by Day of Week</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={timePatterns.dayOfWeek.data}>
                      <XAxis
                        dataKey="day"
                        tick={{ fill: '#a1a1aa', fontSize: 11 }}
                        axisLine={{ stroke: '#3f3f46' }}
                      />
                      <YAxis
                        tick={{ fill: '#a1a1aa', fontSize: 11 }}
                        axisLine={{ stroke: '#3f3f46' }}
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46' }}
                        labelStyle={{ color: '#fff' }}
                      />
                      <Bar dataKey="count" fill={COLORS.secondary}>
                        {timePatterns.dayOfWeek.data.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.day === timePatterns.dayOfWeek.highestDay ? COLORS.danger : COLORS.secondary}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Enforcement by Hour</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={timePatterns.hourlyPattern.data}>
                      <XAxis
                        dataKey="label"
                        tick={{ fill: '#a1a1aa', fontSize: 10 }}
                        axisLine={{ stroke: '#3f3f46' }}
                        interval={2}
                      />
                      <YAxis
                        tick={{ fill: '#a1a1aa', fontSize: 11 }}
                        axisLine={{ stroke: '#3f3f46' }}
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46' }}
                        labelStyle={{ color: '#fff' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="count"
                        stroke={COLORS.primary}
                        strokeWidth={2}
                        dot={{ fill: COLORS.primary, r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-sm text-zinc-400 mt-2">
                  Peak hours: {timePatterns.hourlyPattern.peakHours.map(h => `${h}:00`).join(', ')}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Weekend vs Weekday */}
          <Card className="bg-zinc-800/30">
            <CardContent className="py-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                    {timePatterns.weekendVsWeekday.difference < 0 ? (
                      <TrendingDown className="text-green-500" size={24} />
                    ) : (
                      <TrendingUp className="text-red-500" size={24} />
                    )}
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-white">Weekend vs Weekday</h4>
                    <p className="text-zinc-400">{timePatterns.weekendVsWeekday.insight}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-zinc-400">Weekday avg/day</p>
                  <p className="text-2xl font-bold text-white">
                    {timePatterns.weekendVsWeekday.weekdayAvgPerDay.toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Threshold Tab */}
      {activeTab === 'threshold' && thresholds && (
        <div className="space-y-6">
          {/* Main Insight */}
          <div className="bg-gradient-to-r from-green-500/10 via-yellow-500/10 to-red-500/10 border border-zinc-700 rounded-xl p-6">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-xl bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                <Gauge size={28} className="text-violet-500" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-2">How Fast Is Too Fast?</h3>
                <p className="text-zinc-300 text-lg">{thresholds.overall.insight}</p>
              </div>
            </div>
          </div>

          {/* Speed Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Speed-Over Ticket Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={thresholds.overall.distribution}>
                    <XAxis
                      dataKey="bucket"
                      tick={{ fill: '#a1a1aa', fontSize: 12 }}
                      axisLine={{ stroke: '#3f3f46' }}
                      label={{ value: 'MPH Over Limit', position: 'insideBottom', offset: -5, fill: '#71717a' }}
                    />
                    <YAxis
                      tick={{ fill: '#a1a1aa', fontSize: 11 }}
                      axisLine={{ stroke: '#3f3f46' }}
                      label={{ value: '% of Tickets', angle: -90, position: 'insideLeft', fill: '#71717a' }}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46' }}
                      formatter={(value: number) => [`${value}%`, 'Percentage']}
                    />
                    <Bar dataKey="percentage" radius={[4, 4, 0, 0]}>
                      {thresholds.overall.distribution.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={
                            entry.bucket === '1-4' || entry.bucket === '5-9'
                              ? COLORS.success
                              : entry.bucket === '10-14'
                              ? COLORS.warning
                              : entry.bucket === '15-19'
                              ? COLORS.primary
                              : COLORS.danger
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Risk Levels Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Risk Level Guide</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {thresholds.recommendations.riskLevels.map((level, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/50"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: RISK_COLORS[level.risk] || COLORS.info }}
                      />
                      <span className="text-white font-medium">{level.speedOver} mph over</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-zinc-400 text-sm">{level.description}</span>
                      <span
                        className={cn(
                          'px-2 py-0.5 text-xs rounded-full uppercase font-medium',
                          level.risk === 'very_low' && 'bg-green-500/20 text-green-400',
                          level.risk === 'low' && 'bg-green-500/20 text-green-300',
                          level.risk === 'moderate' && 'bg-yellow-500/20 text-yellow-400',
                          level.risk === 'high' && 'bg-violet-500/20 text-violet-400',
                          level.risk === 'very_high' && 'bg-red-500/20 text-red-400'
                        )}
                      >
                        {level.risk.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* By Detection Method */}
          {thresholds.byMethod.methods.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Threshold by Detection Method</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {thresholds.byMethod.methods.map((method, i) => (
                    <div key={i} className="bg-zinc-800/50 rounded-xl p-4">
                      <h4 className="text-lg font-semibold text-white capitalize mb-2">{method.method}</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-zinc-400">Avg Speed Over</span>
                          <span className="text-white font-medium">{method.avgSpeedOver} mph</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-400">Median</span>
                          <span className="text-white font-medium">{method.medianSpeedOver} mph</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-400">Min Typical</span>
                          <span className="text-violet-400 font-medium">{method.minTypical}+ mph</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-400">Total Tickets</span>
                          <span className="text-zinc-300">{method.count.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Location Tab */}
      {activeTab === 'location' && hotspots && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6">
            <div className="flex items-start gap-4">
              <Target className="text-red-500 flex-shrink-0" size={32} />
              <div>
                <h3 className="text-xl font-bold text-white mb-2">Speed Trap Hotspots</h3>
                <p className="text-zinc-300">{hotspots.summary.insight}</p>
              </div>
            </div>
          </div>

          {/* Hotspot Cards */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {hotspots.hotspots.slice(0, 12).map((hotspot, i) => (
              <Card
                key={hotspot.id}
                className={cn(
                  'transition-all hover:border-zinc-600 cursor-pointer',
                  hotspot.severity === 'critical' && 'border-red-500/50',
                  hotspot.severity === 'high' && 'border-violet-500/50'
                )}
                onClick={() => setSelectedLocation(`${hotspot.lat.toFixed(3)}_${hotspot.lng.toFixed(3)}`)}
              >
                <CardContent className="py-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold text-zinc-500">#{i + 1}</span>
                      <span
                        className={cn(
                          'px-2 py-0.5 text-xs rounded-full uppercase font-medium',
                          hotspot.severity === 'critical' && 'bg-red-500/20 text-red-400',
                          hotspot.severity === 'high' && 'bg-violet-500/20 text-violet-400',
                          hotspot.severity === 'moderate' && 'bg-yellow-500/20 text-yellow-400'
                        )}
                      >
                        {hotspot.severity}
                      </span>
                    </div>
                    <span className="text-xs text-zinc-500 font-mono">
                      {hotspot.lat.toFixed(3)}, {hotspot.lng.toFixed(3)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <p className="text-xs text-zinc-500">Total Stops</p>
                      <p className="text-lg font-bold text-white">{hotspot.totalStops}</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">Unique Days</p>
                      <p className="text-lg font-bold text-zinc-300">{hotspot.uniqueDays}</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">Avg Over</p>
                      <p className="text-lg font-bold text-violet-400">+{hotspot.avgSpeedOver} mph</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">Detection</p>
                      <p className="text-lg font-bold text-zinc-300 capitalize">{hotspot.dominantMethod}</p>
                    </div>
                  </div>
                  <p className="text-xs text-zinc-400">{hotspot.insight}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Routes Tab */}
      {activeTab === 'routes' && corridors && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="bg-violet-500/10 border border-violet-500/30 rounded-xl p-6">
            <div className="flex items-start gap-4">
              <Route className="text-violet-500 flex-shrink-0" size={32} />
              <div>
                <h3 className="text-xl font-bold text-white mb-2">High-Risk Corridors</h3>
                <p className="text-zinc-300">{corridors.summary.insight}</p>
              </div>
            </div>
          </div>

          {/* Corridor List */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Enforcement Density by Corridor</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {corridors.corridors.slice(0, 10).map((corridor, i) => (
                  <div
                    key={corridor.id}
                    className="flex items-center justify-between p-4 rounded-xl bg-zinc-800/50 hover:bg-zinc-800 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-lg font-bold text-zinc-500 w-8">#{i + 1}</span>
                      <div>
                        <p className="text-white font-medium">{corridor.insight}</p>
                        {corridor.hotWindows.length > 0 && (
                          <p className="text-sm text-red-400 mt-1">
                            Avoid: {corridor.hotWindows[0].day} {corridor.hotWindows[0].hours}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-2xl font-bold text-white">{corridor.stopsPerMile}</p>
                        <p className="text-xs text-zinc-500">stops/mile</p>
                      </div>
                      <span
                        className={cn(
                          'px-3 py-1 text-xs rounded-full uppercase font-medium',
                          corridor.riskLevel === 'critical' && 'bg-red-500/20 text-red-400',
                          corridor.riskLevel === 'high' && 'bg-violet-500/20 text-violet-400',
                          corridor.riskLevel === 'moderate' && 'bg-yellow-500/20 text-yellow-400',
                          corridor.riskLevel === 'low' && 'bg-green-500/20 text-green-400'
                        )}
                      >
                        {corridor.riskLevel}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Data Notice */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 text-sm text-zinc-400">
        <p className="flex items-center gap-2">
          <AlertTriangle size={16} className="text-yellow-500" />
          <span>
            <strong className="text-zinc-300">Disclaimer:</strong> This analysis is based on historical
            traffic enforcement data and patterns may have changed. Always follow posted speed limits.
          </span>
        </p>
      </div>
    </div>
  );
}
