'use client';

import Link from 'next/link';
import { Verified, Star, MapPin, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ShopCardProps {
  shop: {
    _id: string;
    name: string;
    slug: string;
    shortDescription?: string;
    logo?: string;
    banner?: string;
    isVerified: boolean;
    averageRating: number;
    reviewCount: number;
    followerCount: number;
    activeListings: number;
    location?: {
      city?: string;
      state?: string;
    };
    categories?: string[];
    primaryColor?: string;
  };
}

export function ShopCard({ shop }: ShopCardProps) {
  const locationText = [shop.location?.city, shop.location?.state]
    .filter(Boolean)
    .join(', ');

  return (
    <Link
      href={`/marketplace/shop/${shop.slug}`}
      className="group block bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800 hover:border-zinc-700 transition-all"
    >
      {/* Banner */}
      <div
        className="relative h-24 bg-gradient-to-r"
        style={{
          backgroundImage: shop.banner
            ? `url(${shop.banner})`
            : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundColor: shop.primaryColor || '#7c3aed',
        }}
      >
        {/* Logo */}
        <div className="absolute -bottom-8 left-4">
          <div className="w-16 h-16 rounded-xl bg-zinc-800 border-4 border-zinc-900 overflow-hidden flex items-center justify-center">
            {shop.logo ? (
              <img
                src={shop.logo}
                alt={shop.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-2xl font-bold text-white">
                {shop.name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 pt-10 space-y-3">
        {/* Name and verified badge */}
        <div className="flex items-start gap-2">
          <h3 className="font-bold text-white group-hover:text-red-400 transition-colors">
            {shop.name}
          </h3>
          {shop.isVerified && (
            <Verified className="w-5 h-5 text-blue-400 flex-shrink-0" />
          )}
        </div>

        {/* Description */}
        {shop.shortDescription && (
          <p className="text-sm text-zinc-400 line-clamp-2">
            {shop.shortDescription}
          </p>
        )}

        {/* Stats */}
        <div className="flex items-center gap-4 text-sm">
          {shop.reviewCount > 0 && (
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
              <span className="text-white font-medium">
                {shop.averageRating.toFixed(1)}
              </span>
              <span className="text-zinc-500">({shop.reviewCount})</span>
            </div>
          )}
          <div className="flex items-center gap-1 text-zinc-400">
            <Package className="w-4 h-4" />
            <span>{shop.activeListings} listings</span>
          </div>
        </div>

        {/* Location */}
        {locationText && (
          <div className="flex items-center gap-1 text-xs text-zinc-500">
            <MapPin className="w-3 h-3" />
            <span>{locationText}</span>
          </div>
        )}

        {/* Categories */}
        {shop.categories && shop.categories.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {shop.categories.slice(0, 3).map((cat) => (
              <span
                key={cat}
                className="px-2 py-0.5 bg-zinc-800 text-zinc-400 text-xs rounded"
              >
                {cat}
              </span>
            ))}
            {shop.categories.length > 3 && (
              <span className="px-2 py-0.5 text-zinc-500 text-xs">
                +{shop.categories.length - 3} more
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
