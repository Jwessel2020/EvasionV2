'use client';

import { cn } from '@/lib/utils';
import { LISTING_CONDITIONS } from '@/lib/marketplace/constants';

interface ConditionBadgeProps {
  condition: string;
  size?: 'sm' | 'md' | 'lg';
}

export function ConditionBadge({ condition, size = 'md' }: ConditionBadgeProps) {
  const conditionData = LISTING_CONDITIONS.find((c) => c.value === condition);

  const sizeClasses = {
    sm: 'px-1.5 py-0.5 text-xs',
    md: 'px-2 py-1 text-sm',
    lg: 'px-3 py-1.5 text-base',
  };

  const colorClasses = {
    green: 'bg-green-500/20 text-green-400 border-green-500/30',
    emerald: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    yellow: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    red: 'bg-red-500/20 text-red-400 border-red-500/30',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded border',
        sizeClasses[size],
        colorClasses[(conditionData?.color as keyof typeof colorClasses) || 'blue']
      )}
    >
      {conditionData?.label || condition}
    </span>
  );
}
