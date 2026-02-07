'use client';

import { Gauge, Radio, Zap, Clock, Car } from 'lucide-react';

interface DetectionMethodBreakdownProps {
  data: Array<{
    method: string;
    count: number;
    percentage: number;
  }>;
}

const getMethodColor = (method: string) => {
  switch (method.toLowerCase()) {
    case 'radar':
      return 'text-blue-400';
    case 'laser':
      return 'text-red-400';
    case 'vascar':
      return 'text-yellow-400';
    case 'patrol':
      return 'text-green-400';
    case 'automated':
      return 'text-purple-400';
    default:
      return 'text-zinc-400';
  }
};

const getMethodBgColor = (method: string) => {
  switch (method.toLowerCase()) {
    case 'radar':
      return 'bg-blue-500';
    case 'laser':
      return 'bg-red-500';
    case 'vascar':
      return 'bg-yellow-500';
    case 'patrol':
      return 'bg-green-500';
    case 'automated':
      return 'bg-purple-500';
    default:
      return 'bg-violet-500';
  }
};

const getMethodIcon = (method: string) => {
  switch (method.toLowerCase()) {
    case 'radar':
      return Radio;
    case 'laser':
      return Zap;
    case 'vascar':
      return Clock;
    case 'patrol':
      return Car;
    default:
      return Gauge;
  }
};

export function DetectionMethodBreakdown({ data }: DetectionMethodBreakdownProps) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Radio size={18} className="text-violet-400" />
          Detection Method Breakdown
        </h3>
        <p className="text-zinc-500 text-center py-8">No detection method data available</p>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <Radio size={18} className="text-violet-400" />
        Detection Method Breakdown
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {data.map((m) => {
          const Icon = getMethodIcon(m.method);
          return (
            <div key={m.method} className="bg-zinc-800/50 rounded-lg p-4 text-center">
              <Icon className={`${getMethodColor(m.method)} mx-auto mb-2`} size={28} />
              <p className="text-white font-semibold capitalize">{m.method}</p>
              <p className="text-zinc-400 text-sm">{m.count.toLocaleString()}</p>
              <div className="mt-2 bg-zinc-700 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full ${getMethodBgColor(m.method)} transition-all duration-500`}
                  style={{ width: `${m.percentage}%` }}
                />
              </div>
              <p className="text-xs text-zinc-500 mt-1">{m.percentage.toFixed(1)}%</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
