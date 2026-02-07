'use client';

import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  trend?: {
    value: number;
    label: string;
    positive?: boolean;
  };
  color?: 'default' | 'violet' | 'red' | 'green' | 'blue' | 'purple';
  className?: string;
}

const colorStyles = {
  default: 'bg-zinc-900 border-zinc-800',
  violet: 'bg-violet-500/10 border-violet-500/20',
  red: 'bg-red-500/10 border-red-500/20',
  green: 'bg-green-500/10 border-green-500/20',
  blue: 'bg-blue-500/10 border-blue-500/20',
  purple: 'bg-purple-500/10 border-purple-500/20',
};

const iconColors = {
  default: 'bg-zinc-800 text-zinc-400',
  violet: 'bg-violet-500/20 text-violet-500',
  red: 'bg-red-500/20 text-red-500',
  green: 'bg-green-500/20 text-green-500',
  blue: 'bg-blue-500/20 text-blue-500',
  purple: 'bg-purple-500/20 text-purple-500',
};

export function StatsCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  color = 'default',
  className,
}: StatsCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border p-5 transition-all hover:border-zinc-700',
        colorStyles[color],
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-zinc-400 mb-1">{title}</p>
          <p className="text-3xl font-bold text-white">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
          {subtitle && (
            <p className="text-sm text-zinc-500 mt-1">{subtitle}</p>
          )}
          {trend && (
            <div className="flex items-center gap-1 mt-2">
              <span
                className={cn(
                  'text-sm font-medium',
                  trend.positive ? 'text-green-400' : 'text-red-400'
                )}
              >
                {trend.positive ? '↑' : '↓'} {Math.abs(trend.value)}%
              </span>
              <span className="text-xs text-zinc-500">{trend.label}</span>
            </div>
          )}
        </div>
        {icon && (
          <div
            className={cn(
              'w-12 h-12 rounded-lg flex items-center justify-center',
              iconColors[color]
            )}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
