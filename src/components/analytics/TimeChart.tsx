'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface TimeChartProps {
  data: Array<{
    label: string;
    count: number;
    alcoholCount?: number;
    accidentCount?: number;
  }>;
  title: string;
  showBreakdown?: boolean;
}

export function TimeChart({ data, title, showBreakdown = false }: TimeChartProps) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis
              dataKey="label"
              tick={{ fill: '#71717a', fontSize: 11 }}
              axisLine={{ stroke: '#27272a' }}
              tickLine={{ stroke: '#27272a' }}
            />
            <YAxis
              tick={{ fill: '#71717a', fontSize: 11 }}
              axisLine={{ stroke: '#27272a' }}
              tickLine={{ stroke: '#27272a' }}
              tickFormatter={(value) => {
                if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
                return value.toString();
              }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#18181b',
                border: '1px solid #27272a',
                borderRadius: '8px',
              }}
              labelStyle={{ color: '#fff', fontWeight: 'bold' }}
              itemStyle={{ color: '#a1a1aa' }}
              formatter={(value) => value !== undefined ? [value.toLocaleString(), ''] : ['', '']}
            />
            {showBreakdown && <Legend />}
            <Bar
              dataKey="count"
              name="Total Stops"
              fill="#a855f7"
              radius={[4, 4, 0, 0]}
            />
            {showBreakdown && (
              <>
                <Bar
                  dataKey="alcoholCount"
                  name="Alcohol"
                  fill="#ef4444"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="accidentCount"
                  name="Accidents"
                  fill="#3b82f6"
                  radius={[4, 4, 0, 0]}
                />
              </>
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
