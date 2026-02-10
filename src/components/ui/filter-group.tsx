'use client';

import { useState, type ReactNode, type ElementType } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Toggle Button Group - Compact multi-select buttons
 */
export interface ToggleOption<T = string | null> {
  value: T;
  label: string;
  icon?: string | ReactNode;
  activeColor?: 'red' | 'orange' | 'blue' | 'green' | 'purple' | 'yellow' | 'violet';
}

export interface ToggleButtonGroupProps<T = string | null> {
  options: readonly ToggleOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
  className?: string;
}

const activeColorClasses = {
  red: 'bg-red-500/20 border-red-500/50 text-red-400',
  orange: 'bg-orange-500/20 border-orange-500/50 text-orange-400',
  blue: 'bg-blue-500/20 border-blue-500/50 text-blue-400',
  green: 'bg-green-500/20 border-green-500/50 text-green-400',
  purple: 'bg-purple-500/20 border-purple-500/50 text-purple-400',
  yellow: 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400',
  violet: 'bg-violet-500/20 border-violet-500/50 text-violet-400',
};

export function ToggleButtonGroup<T = string | null>({
  options,
  value,
  onChange,
  size = 'md',
  className,
}: ToggleButtonGroupProps<T>) {
  const sizeClasses = size === 'sm' ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm';

  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {options.map((option) => {
        const isActive = value === option.value;
        const colorClass = isActive && option.activeColor
          ? activeColorClasses[option.activeColor]
          : isActive
            ? 'bg-violet-500/20 border-violet-500/50 text-violet-400'
            : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600';

        return (
          <button
            key={String(option.value)}
            onClick={() => onChange(isActive ? (null as T) : option.value)}
            className={cn(
              'rounded-lg font-medium transition-colors border flex items-center gap-1',
              sizeClasses,
              colorClass
            )}
          >
            {option.icon && (
              typeof option.icon === 'string' ? (
                <span>{option.icon}</span>
              ) : (
                option.icon
              )
            )}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Filter Select - Styled dropdown select
 */
export interface FilterSelectOption<T = string | number | null> {
  value: T;
  label: string;
}

export interface FilterSelectProps<T = string | number | null> {
  options: readonly FilterSelectOption<T>[];
  value: T;
  onChange: (value: T) => void;
  icon?: ElementType;
  label?: string;
  className?: string;
}

export function FilterSelect<T = string | number | null>({
  options,
  value,
  onChange,
  icon: Icon,
  label,
  className,
}: FilterSelectProps<T>) {
  return (
    <div className={className}>
      {label && (
        <label className="text-xs text-zinc-400 mb-1.5 block flex items-center gap-1">
          {Icon && <Icon size={12} />}
          {label}
        </label>
      )}
      <select
        value={String(value ?? '')}
        onChange={(e) => {
          const rawValue = e.target.value;
          if (rawValue === '') {
            onChange(null as T);
          } else if (!isNaN(Number(rawValue)) && rawValue !== '') {
            onChange(Number(rawValue) as T);
          } else {
            onChange(rawValue as T);
          }
        }}
        className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
      >
        {options.map((opt) => (
          <option key={String(opt.value ?? 'null')} value={String(opt.value ?? '')}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * Collapsible Filter Section
 */
export interface FilterSectionProps {
  title: string;
  icon?: ElementType;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  badge?: number;
}

export function FilterSection({
  title,
  icon: Icon,
  children,
  defaultOpen = true,
  className,
  badge,
}: FilterSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={cn('border-b border-zinc-800 last:border-b-0', className)}>
      <button
        className="w-full px-3 py-2.5 flex items-center justify-between hover:bg-zinc-800/50 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2">
          {Icon && <Icon size={14} className="text-zinc-400" />}
          <span className="text-sm font-medium text-zinc-200">{title}</span>
          {badge !== undefined && badge > 0 && (
            <span className="px-1.5 py-0.5 bg-violet-500/20 text-violet-400 text-xs rounded-full">
              {badge}
            </span>
          )}
        </div>
        {isOpen ? (
          <ChevronUp size={14} className="text-zinc-400" />
        ) : (
          <ChevronDown size={14} className="text-zinc-400" />
        )}
      </button>
      {isOpen && (
        <div className="px-3 pb-3 space-y-3">
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * Filter Tabs - Tab navigation for filter categories
 */
export interface FilterTabsProps {
  tabs: { id: string; label: string; icon?: ElementType }[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  className?: string;
}

export function FilterTabs({ tabs, activeTab, onTabChange, className }: FilterTabsProps) {
  return (
    <div className={cn('flex border-b border-zinc-800', className)}>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              'flex-1 px-3 py-2 text-xs font-medium transition-colors flex items-center justify-center gap-1',
              activeTab === tab.id
                ? 'text-violet-400 border-b-2 border-violet-400 -mb-px'
                : 'text-zinc-400 hover:text-zinc-200'
            )}
          >
            {Icon && <Icon size={12} />}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Quick Toggle Button - Single toggle with active state
 */
export interface QuickToggleProps {
  isActive: boolean;
  onClick: () => void;
  icon?: ElementType | string;
  label: string;
  activeColor?: 'red' | 'orange' | 'blue' | 'green' | 'purple' | 'yellow' | 'violet';
  className?: string;
}

export function QuickToggle({
  isActive,
  onClick,
  icon: Icon,
  label,
  activeColor = 'violet',
  className,
}: QuickToggleProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors border flex items-center justify-center gap-2',
        isActive
          ? activeColorClasses[activeColor]
          : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600',
        className
      )}
    >
      {Icon && (
        typeof Icon === 'string' ? (
          <span>{Icon}</span>
        ) : (
          <Icon size={16} />
        )
      )}
      {label}
    </button>
  );
}
