'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface VehicleDistributionProps {
  data: Array<{
    make: string;
    count: number;
    percentage: number;
  }>;
}

const COLORS = [
  '#3b82f6', // blue
  '#a855f7', // violet
  '#8b5cf6', // purple
  '#22c55e', // green
  '#ef4444', // red
  '#06b6d4', // cyan
  '#f59e0b', // amber
  '#ec4899', // pink
  '#10b981', // emerald
  '#6366f1', // indigo
];

export function VehicleDistribution({ data }: VehicleDistributionProps) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <h3 className="text-lg font-semibold text-white mb-4">Vehicle Distribution</h3>
        <p className="text-zinc-500 text-center py-8">No vehicle data available</p>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <h3 className="text-lg font-semibold text-white mb-4">Vehicle Distribution</h3>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 5, right: 5, left: 0, bottom: 60 }}
            layout="vertical"
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis
              type="number"
              tick={{ fill: '#71717a', fontSize: 11 }}
              axisLine={{ stroke: '#27272a' }}
              tickLine={{ stroke: '#27272a' }}
              tickFormatter={(value) => {
                if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
                return value.toString();
              }}
            />
            <YAxis
              type="category"
              dataKey="make"
              tick={{ fill: '#71717a', fontSize: 11 }}
              axisLine={{ stroke: '#27272a' }}
              tickLine={{ stroke: '#27272a' }}
              width={100}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#18181b',
                border: '1px solid #27272a',
                borderRadius: '8px',
              }}
              labelStyle={{ color: '#fff', fontWeight: 'bold' }}
              itemStyle={{ color: '#a1a1aa' }}
              formatter={(value, name, props: any) => [
                `${value?.toLocaleString()} (${props?.payload?.percentage?.toFixed(1)}%)`,
                'Stops',
              ]}
            />
            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
