'use client';

import { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { X, MapPin, Clock, Calendar, Zap, TrendingUp, AlertTriangle } from 'lucide-react';

interface LocationProfileProps {
  gridId: string;
  onClose: () => void;
}

interface LocationData {
  location: {
    gridId: string;
    lat: number;
    lng: number;
  };
  temporalSignature: {
    hourDistribution: number[];
    dayDistribution: number[];
    peakHours: number[];
    peakDays: string[];
    peakDayNumbers: number[];
    hourConcentration: number;
    dayConcentration: number;
    weekdayRatio: number;
    insight: string;
  };
  detectionProfile: {
    primaryMethod: string;
    methodDistribution: Record<string, number>;
    avgSpeedOver: number;
    strictnessLevel: string;
    insight: string;
  };
  statistics: {
    totalStops: number;
    hourChi2: number;
    hourPvalue: number;
    isSignificant: boolean;
    confidenceLevel: string;
  };
  generatedInsight: string;
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOUR_LABELS = Array.from({ length: 24 }, (_, i) => `${i}:00`);

export function LocationProfile({ gridId, onClose }: LocationProfileProps) {
  const [data, setData] = useState<LocationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch(`/api/insights/ml/location/${encodeURIComponent(gridId)}`);
        const result = await response.json();

        if (result.success) {
          setData(result.data);
        } else {
          setError(result.error || 'Failed to load location data');
        }
      } catch (err) {
        setError('Failed to fetch location data');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [gridId]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-gray-900 rounded-lg p-8">
          <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-gray-900 rounded-lg p-6 max-w-md">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-red-400">Error</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-white">
              <X size={20} />
            </button>
          </div>
          <p className="text-gray-300">{error}</p>
        </div>
      </div>
    );
  }

  // Prepare chart data
  const hourChartData = data.temporalSignature.hourDistribution.map((value, hour) => ({
    hour: hour.toString(),
    label: HOUR_LABELS[hour],
    value: Math.round(value * 100),
    isPeak: data.temporalSignature.peakHours.includes(hour),
  }));

  const dayChartData = data.temporalSignature.dayDistribution.map((value, day) => ({
    day: DAY_LABELS[day],
    value: Math.round(value * 100),
    isPeak: data.temporalSignature.peakDayNumbers.includes(day),
  }));

  const strictnessColors: Record<string, string> = {
    strict: 'text-red-400',
    moderate: 'text-yellow-400',
    lenient: 'text-green-400',
  };

  const confidenceColors: Record<string, string> = {
    high: 'bg-green-500/20 text-green-400 border-green-500/30',
    medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    low: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gray-900 border-b border-gray-700 p-4 flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2 text-blue-400 mb-1">
              <MapPin size={18} />
              <span className="text-sm font-mono">{gridId}</span>
            </div>
            <h2 className="text-xl font-bold text-white">Location Profile</h2>
            <p className="text-gray-400 text-sm mt-1">
              ML-learned patterns from {data.statistics.totalStops} historical stops
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1"
          >
            <X size={24} />
          </button>
        </div>

        {/* Main Insight */}
        <div className="p-4 bg-blue-500/10 border-b border-gray-700">
          <div className="flex items-start gap-3">
            <Zap className="text-blue-400 mt-1 flex-shrink-0" size={20} />
            <div>
              <h3 className="text-blue-400 font-semibold mb-1">ML-Generated Insight</h3>
              <p className="text-white">{data.generatedInsight}</p>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-6">
          {/* Temporal Signature */}
          <section>
            <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
              <Clock size={18} className="text-blue-400" />
              Temporal Signature
            </h3>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Hour Distribution */}
              <div className="bg-gray-800 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-400 mb-3">Hour Distribution</h4>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={hourChartData}>
                      <XAxis
                        dataKey="hour"
                        tick={{ fill: '#9CA3AF', fontSize: 10 }}
                        tickFormatter={(v) => (parseInt(v) % 4 === 0 ? `${v}h` : '')}
                      />
                      <YAxis hide />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload?.[0]) {
                            const d = payload[0].payload;
                            return (
                              <div className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm">
                                <span className="text-white">{d.label}: </span>
                                <span className="text-blue-400">{d.value}%</span>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="value" radius={[2, 2, 0, 0]}>
                        {hourChartData.map((entry, idx) => (
                          <Cell
                            key={idx}
                            fill={entry.isPeak ? '#3B82F6' : '#4B5563'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-2 text-sm text-gray-400">
                  Peak hours:{' '}
                  <span className="text-blue-400">
                    {data.temporalSignature.peakHours.map(h => `${h}:00`).join(', ')}
                  </span>
                </div>
              </div>

              {/* Day Distribution */}
              <div className="bg-gray-800 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-400 mb-3">Day Distribution</h4>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dayChartData}>
                      <XAxis dataKey="day" tick={{ fill: '#9CA3AF', fontSize: 12 }} />
                      <YAxis hide />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload?.[0]) {
                            const d = payload[0].payload;
                            return (
                              <div className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm">
                                <span className="text-white">{d.day}: </span>
                                <span className="text-green-400">{d.value}%</span>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {dayChartData.map((entry, idx) => (
                          <Cell
                            key={idx}
                            fill={entry.isPeak ? '#22C55E' : '#4B5563'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-2 text-sm text-gray-400">
                  Peak days:{' '}
                  <span className="text-green-400">
                    {data.temporalSignature.peakDays.slice(0, 2).join(', ')}
                  </span>
                </div>
              </div>
            </div>

            {/* Concentration Stats */}
            <div className="grid grid-cols-3 gap-4 mt-4">
              <div className="bg-gray-800 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-blue-400">
                  {Math.round(data.temporalSignature.hourConcentration * 100)}%
                </div>
                <div className="text-xs text-gray-400">Hour Concentration</div>
              </div>
              <div className="bg-gray-800 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-green-400">
                  {Math.round(data.temporalSignature.dayConcentration * 100)}%
                </div>
                <div className="text-xs text-gray-400">Day Concentration</div>
              </div>
              <div className="bg-gray-800 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-yellow-400">
                  {Math.round(data.temporalSignature.weekdayRatio * 100)}%
                </div>
                <div className="text-xs text-gray-400">Weekday Ratio</div>
              </div>
            </div>
          </section>

          {/* Detection Profile */}
          <section>
            <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
              <TrendingUp size={18} className="text-purple-400" />
              Detection Profile
            </h3>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="text-sm text-gray-400 mb-1">Primary Method</div>
                <div className="text-xl font-bold text-purple-400 capitalize">
                  {data.detectionProfile.primaryMethod}
                </div>
              </div>
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="text-sm text-gray-400 mb-1">Avg Speed Over</div>
                <div className="text-xl font-bold text-white">
                  {data.detectionProfile.avgSpeedOver} mph
                </div>
              </div>
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="text-sm text-gray-400 mb-1">Strictness Level</div>
                <div className={`text-xl font-bold capitalize ${strictnessColors[data.detectionProfile.strictnessLevel]}`}>
                  {data.detectionProfile.strictnessLevel}
                </div>
              </div>
            </div>

            {/* Method Distribution */}
            {Object.keys(data.detectionProfile.methodDistribution).length > 0 && (
              <div className="mt-4 bg-gray-800 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-400 mb-3">Method Distribution</h4>
                <div className="space-y-2">
                  {Object.entries(data.detectionProfile.methodDistribution)
                    .sort((a, b) => b[1] - a[1])
                    .map(([method, pct]) => (
                      <div key={method} className="flex items-center gap-3">
                        <span className="text-sm text-gray-300 w-20 capitalize">{method}</span>
                        <div className="flex-1 bg-gray-700 rounded-full h-2">
                          <div
                            className="bg-purple-500 h-2 rounded-full"
                            style={{ width: `${pct * 100}%` }}
                          />
                        </div>
                        <span className="text-sm text-gray-400 w-12 text-right">
                          {Math.round(pct * 100)}%
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </section>

          {/* Statistical Significance */}
          <section>
            <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
              <AlertTriangle size={18} className="text-yellow-400" />
              Statistical Analysis
            </h3>

            <div className="bg-gray-800 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-gray-400 text-sm">Pattern Significance: </span>
                  <span className={`inline-block px-2 py-0.5 rounded border text-sm ${confidenceColors[data.statistics.confidenceLevel]}`}>
                    {data.statistics.isSignificant ? 'Significant' : 'Not Significant'}
                    {data.statistics.isSignificant && ` (${data.statistics.confidenceLevel} confidence)`}
                  </span>
                </div>
                <div className="text-sm text-gray-400">
                  p-value: {data.statistics.hourPvalue < 0.001 ? '< 0.001' : data.statistics.hourPvalue.toFixed(3)}
                </div>
              </div>
              {data.statistics.isSignificant && (
                <p className="mt-2 text-sm text-gray-300">
                  The temporal pattern at this location is statistically significant,
                  meaning it&apos;s unlikely to have occurred by random chance.
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
