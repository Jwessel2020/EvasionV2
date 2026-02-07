'use client';

import { X, MapPin, Calendar, TrendingUp, Clock } from 'lucide-react';
import { VehicleDistribution } from './VehicleDistribution';
import { DetectionMethodBreakdown } from './DetectionMethodBreakdown';
import { TimeChart } from './TimeChart';

interface DrillDownData {
  summary: {
    totalStops: number;
    dateRange: { earliest: string; latest: string };
    topLocation: string;
  };
  vehicles: Array<{ make: string; count: number; percentage: number }>;
  timePatterns: {
    byHour: Array<{ hour: number; count: number }>;
    byDay: Array<{ day: number; count: number }>;
  };
  detectionMethods: Array<{ method: string; count: number; percentage: number }>;
  speedStats?: {
    avgSpeedOver: number;
    maxSpeedOver: number;
  };
  chargeTypes?: Array<{ type: string; count: number; percentage: number }>;
  monthlyDistribution?: Array<{ month: number; count: number }>;
  yearlyDistribution?: Array<{ year: number; count: number }>;
}

interface DrillDownPanelProps {
  data: DrillDownData;
  isLoading?: boolean;
  bounds: [number, number, number, number] | null;
  onClose: () => void;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function DrillDownPanel({ data, isLoading, bounds, onClose }: DrillDownPanelProps) {
  // Format data for TimeChart component
  const hourlyData = data.timePatterns.byHour.map((h) => ({
    label: `${h.hour}:00`,
    count: h.count,
  }));

  const dailyData = data.timePatterns.byDay.map((d) => ({
    label: DAY_NAMES[d.day]?.substring(0, 3) || `Day ${d.day}`,
    count: d.count,
  }));

  return (
    <>
      {/* Overlay for mobile */}
      <div
        className="fixed inset-0 bg-black/50 z-40 md:hidden"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 w-full md:w-[480px] bg-zinc-950 border-l border-zinc-800 z-50 overflow-y-auto shadow-2xl transform transition-transform duration-300 ease-in-out">
        {/* Header */}
        <div className="sticky top-0 bg-zinc-950 border-b border-zinc-800 p-4 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <MapPin size={20} className="text-blue-500" />
                Area Analytics
              </h2>
              {bounds && (
                <p className="text-xs text-zinc-500 mt-1">
                  {bounds[1].toFixed(4)}, {bounds[0].toFixed(4)} → {bounds[3].toFixed(4)}, {bounds[2].toFixed(4)}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-zinc-800 transition-colors"
              aria-label="Close panel"
            >
              <X size={20} className="text-zinc-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp size={16} className="text-violet-500" />
                <p className="text-zinc-400 text-xs">Total Stops</p>
              </div>
              <p className="text-2xl font-bold text-white">
                {isLoading ? '...' : data.summary.totalStops.toLocaleString()}
              </p>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Calendar size={16} className="text-blue-500" />
                <p className="text-zinc-400 text-xs">Date Range</p>
              </div>
              {isLoading ? (
                <p className="text-sm text-white">...</p>
              ) : (
                <p className="text-sm text-white">
                  {new Date(data.summary.dateRange.earliest).toLocaleDateString('en-US', {
                    month: 'short',
                    year: 'numeric',
                  })}{' '}
                  -{' '}
                  {new Date(data.summary.dateRange.latest).toLocaleDateString('en-US', {
                    month: 'short',
                    year: 'numeric',
                  })}
                </p>
              )}
            </div>
          </div>

          {/* Top Location */}
          {data.summary.topLocation && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <MapPin size={16} className="text-red-500" />
                <p className="text-zinc-400 text-xs">Top Location</p>
              </div>
              <p className="text-sm text-white">{data.summary.topLocation}</p>
            </div>
          )}

          {/* Speed Stats */}
          {data.speedStats && (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <p className="text-zinc-400 text-xs mb-1">Avg Speed Over</p>
                <p className="text-xl font-bold text-violet-400">
                  +{data.speedStats.avgSpeedOver.toFixed(1)} mph
                </p>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <p className="text-zinc-400 text-xs mb-1">Max Speed Over</p>
                <p className="text-xl font-bold text-red-400">
                  +{data.speedStats.maxSpeedOver} mph
                </p>
              </div>
            </div>
          )}

          {/* Vehicle Distribution */}
          <VehicleDistribution data={data.vehicles} />

          {/* Time Patterns */}
          <div className="space-y-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Clock size={18} className="text-blue-400" />
                Hourly Distribution
              </h3>
              <div className="h-48">
                <TimeChart data={hourlyData} title="" showBreakdown={false} />
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <TrendingUp size={18} className="text-green-400" />
                Daily Distribution
              </h3>
              <div className="h-48">
                <TimeChart data={dailyData} title="" showBreakdown={false} />
              </div>
            </div>
          </div>

          {/* Detection Methods */}
          <DetectionMethodBreakdown data={data.detectionMethods} />

          {/* Stop Outcomes */}
          {data.chargeTypes && data.chargeTypes.length > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <h3 className="text-lg font-semibold text-white mb-4">
                Stop Outcomes
              </h3>
              <div className="space-y-3">
                {data.chargeTypes.map((charge) => (
                  <div key={charge.type}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-zinc-300 font-medium">{charge.type}</span>
                      <span className="text-sm text-zinc-400">
                        {charge.count.toLocaleString()} ({charge.percentage.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="w-full bg-zinc-800 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          charge.type === 'Warning' ? 'bg-yellow-500' :
                          charge.type === 'Citation' ? 'bg-red-500' :
                          charge.type === 'ESERO' ? 'bg-blue-500' :
                          charge.type === 'SERO' ? 'bg-purple-500' :
                          'bg-gray-500'
                        }`}
                        style={{ width: `${charge.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Monthly Distribution */}
          {data.monthlyDistribution && data.monthlyDistribution.length > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Calendar size={18} className="text-purple-400" />
                Monthly Distribution
              </h3>
              <div className="h-48">
                <TimeChart
                  data={data.monthlyDistribution.map((m) => ({
                    label: MONTH_NAMES[m.month - 1] || m.month.toString(),
                    count: m.count,
                  }))}
                  title=""
                  showBreakdown={false}
                />
              </div>
            </div>
          )}

          {/* Yearly Distribution */}
          {data.yearlyDistribution && data.yearlyDistribution.length > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <TrendingUp size={18} className="text-cyan-400" />
                Yearly Distribution
              </h3>
              <div className="h-48">
                <TimeChart
                  data={data.yearlyDistribution.map((y) => ({
                    label: y.year.toString(),
                    count: y.count,
                  }))}
                  title=""
                  showBreakdown={false}
                />
              </div>
            </div>
          )}

          {/* Info Note */}
          <div className="p-4 bg-zinc-800/30 rounded-lg border border-zinc-700">
            <p className="text-xs text-zinc-400">
              <span className="font-semibold text-zinc-300">Note:</span> This analysis includes all violations within the selected area that match your current filters.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
