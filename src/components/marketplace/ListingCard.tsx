'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Heart, MapPin, Truck, Tag, Eye, Clock, Verified, Store } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LISTING_CONDITIONS } from '@/lib/marketplace/constants';

interface ListingCardProps {
  listing: {
    _id: string;
    title: string;
    slug: string;
    price: number;
    originalPrice?: number;
    condition: string;
    category: string;
    images: { url: string; thumbnail?: string }[];
    location?: {
      city?: string;
      state?: string;
    };
    shipping?: {
      freeShipping?: boolean;
      localPickup?: boolean;
    };
    sellerUsername: string;
    sellerAvatar?: string;
    shopName?: string;
    shopSlug?: string;
    isFeatured?: boolean;
    viewCount?: number;
    saveCount?: number;
    createdAt: string;
  };
  isSaved?: boolean;
  onSave?: (id: string) => void;
  compact?: boolean;
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;

  return date.toLocaleDateString();
}

export function ListingCard({ listing, isSaved = false, onSave, compact = false }: ListingCardProps) {
  const [saved, setSaved] = useState(isSaved);
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (saving) return;
    setSaving(true);

    const newSaved = !saved;
    setSaved(newSaved);

    try {
      const res = await fetch('/api/marketplace/saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId: listing._id }),
      });

      if (!res.ok) throw new Error();
      onSave?.(listing._id);
    } catch {
      setSaved(!newSaved);
    } finally {
      setSaving(false);
    }
  };

  const condition = LISTING_CONDITIONS.find((c) => c.value === listing.condition);
  const hasDiscount = listing.originalPrice && listing.originalPrice > listing.price;
  const discountPercent = hasDiscount
    ? Math.round((1 - listing.price / listing.originalPrice!) * 100)
    : 0;

  const locationText = [listing.location?.city, listing.location?.state]
    .filter(Boolean)
    .join(', ');

  return (
    <Link
      href={`/marketplace/${listing.slug}`}
      className={cn(
        'group block bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800 hover:border-zinc-700 transition-all',
        listing.isFeatured && 'ring-2 ring-amber-500/50'
      )}
    >
      {/* Image */}
      <div className={cn('relative bg-zinc-800', compact ? 'aspect-square' : 'aspect-[4/3]')}>
        {listing.images[0] ? (
          <img
            src={listing.images[0].thumbnail || listing.images[0].url}
            alt={listing.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-zinc-600">
            <Tag className="w-12 h-12" />
          </div>
        )}

        {/* Featured badge */}
        {listing.isFeatured && (
          <div className="absolute top-2 left-2 px-2 py-1 bg-amber-500 text-black text-xs font-bold rounded">
            Featured
          </div>
        )}

        {/* Discount badge */}
        {hasDiscount && (
          <div className="absolute top-2 right-10 px-2 py-1 bg-green-500 text-white text-xs font-bold rounded">
            -{discountPercent}%
          </div>
        )}

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className={cn(
            'absolute top-2 right-2 p-2 rounded-full transition-colors',
            saved
              ? 'bg-red-500 text-white'
              : 'bg-black/50 text-white hover:bg-black/70'
          )}
        >
          <Heart className={cn('w-4 h-4', saved && 'fill-current')} />
        </button>

        {/* Image count */}
        {listing.images.length > 1 && (
          <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/50 text-white text-xs rounded">
            +{listing.images.length - 1}
          </div>
        )}

        {/* Shipping badges */}
        <div className="absolute bottom-2 left-2 flex gap-1">
          {listing.shipping?.freeShipping && (
            <div className="px-2 py-1 bg-green-600 text-white text-xs font-medium rounded flex items-center gap-1">
              <Truck className="w-3 h-3" />
              Free
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-3 space-y-2">
        {/* Price */}
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-bold text-white">
            {formatPrice(listing.price)}
          </span>
          {hasDiscount && (
            <span className="text-sm text-zinc-500 line-through">
              {formatPrice(listing.originalPrice!)}
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="font-medium text-white line-clamp-2 group-hover:text-red-400 transition-colors">
          {listing.title}
        </h3>

        {/* Condition */}
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'px-2 py-0.5 text-xs font-medium rounded',
              {
                'bg-green-500/20 text-green-400': condition?.color === 'green',
                'bg-emerald-500/20 text-emerald-400': condition?.color === 'emerald',
                'bg-blue-500/20 text-blue-400': condition?.color === 'blue',
                'bg-yellow-500/20 text-yellow-400': condition?.color === 'yellow',
                'bg-red-500/20 text-red-400': condition?.color === 'red',
              }
            )}
          >
            {condition?.label || listing.condition}
          </span>
        </div>

        {/* Location & Seller */}
        <div className="flex items-center justify-between text-xs text-zinc-400">
          <div className="flex items-center gap-1">
            {locationText ? (
              <>
                <MapPin className="w-3 h-3" />
                <span>{locationText}</span>
              </>
            ) : (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatTimeAgo(listing.createdAt)}
              </span>
            )}
          </div>

          {listing.shopName ? (
            <Link
              href={`/marketplace/shop/${listing.shopSlug}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 text-violet-400 hover:text-violet-300"
            >
              <Store className="w-3 h-3" />
              <span>{listing.shopName}</span>
            </Link>
          ) : (
            <span>@{listing.sellerUsername}</span>
          )}
        </div>

        {/* Stats */}
        {!compact && (listing.viewCount || listing.saveCount) && (
          <div className="flex items-center gap-3 pt-2 border-t border-zinc-800 text-xs text-zinc-500">
            {listing.viewCount !== undefined && listing.viewCount > 0 && (
              <span className="flex items-center gap-1">
                <Eye className="w-3 h-3" />
                {listing.viewCount}
              </span>
            )}
            {listing.saveCount !== undefined && listing.saveCount > 0 && (
              <span className="flex items-center gap-1">
                <Heart className="w-3 h-3" />
                {listing.saveCount}
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
