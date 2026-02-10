'use client';

import { cn } from '@/lib/utils';

interface PriceDisplayProps {
  price: number;
  originalPrice?: number;
  currency?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showDiscount?: boolean;
}

function formatPrice(price: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: price % 1 === 0 ? 0 : 2,
  }).format(price);
}

export function PriceDisplay({
  price,
  originalPrice,
  currency = 'USD',
  size = 'md',
  showDiscount = true,
}: PriceDisplayProps) {
  const hasDiscount = originalPrice && originalPrice > price;
  const discountPercent = hasDiscount
    ? Math.round((1 - price / originalPrice) * 100)
    : 0;

  const sizeClasses = {
    sm: 'text-base',
    md: 'text-xl',
    lg: 'text-2xl',
    xl: 'text-3xl',
  };

  const originalSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
    xl: 'text-lg',
  };

  return (
    <div className="flex flex-wrap items-baseline gap-2">
      <span className={cn('font-bold text-white', sizeClasses[size])}>
        {formatPrice(price, currency)}
      </span>

      {hasDiscount && (
        <>
          <span
            className={cn(
              'text-zinc-500 line-through',
              originalSizeClasses[size]
            )}
          >
            {formatPrice(originalPrice, currency)}
          </span>

          {showDiscount && (
            <span
              className={cn(
                'px-1.5 py-0.5 bg-green-500 text-white font-bold rounded',
                originalSizeClasses[size]
              )}
            >
              -{discountPercent}%
            </span>
          )}
        </>
      )}
    </div>
  );
}
