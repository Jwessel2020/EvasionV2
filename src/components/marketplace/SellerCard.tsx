'use client';

import Link from 'next/link';
import { Star, MessageSquare, Clock, Shield } from 'lucide-react';

interface SellerCardProps {
  seller: {
    _id: string;
    username: string;
    displayName?: string;
    avatar?: string;
    reputation?: number;
    createdAt: string;
    marketplaceStats?: {
      averageRating?: number;
      reviewCount?: number;
      listingsCount?: number;
      soldCount?: number;
    };
  };
  onMessage?: () => void;
  showMessageButton?: boolean;
}

function formatMemberSince(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const months = (now.getFullYear() - date.getFullYear()) * 12 + (now.getMonth() - date.getMonth());

  if (months < 1) return 'New member';
  if (months < 12) return `Member for ${months} month${months === 1 ? '' : 's'}`;

  const years = Math.floor(months / 12);
  return `Member for ${years} year${years === 1 ? '' : 's'}`;
}

export function SellerCard({ seller, onMessage, showMessageButton = true }: SellerCardProps) {
  const stats = seller.marketplaceStats;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-full bg-zinc-800 overflow-hidden flex items-center justify-center flex-shrink-0">
          {seller.avatar ? (
            <img
              src={seller.avatar}
              alt={seller.username}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-lg font-bold text-white">
              {seller.username.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <Link
            href={`/marketplace/seller/${seller.username}`}
            className="font-bold text-white hover:text-red-400 transition-colors"
          >
            {seller.displayName || seller.username}
          </Link>
          <p className="text-sm text-zinc-400">@{seller.username}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        {stats?.averageRating !== undefined && stats.averageRating > 0 && (
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
            <div>
              <p className="text-sm font-medium text-white">
                {stats.averageRating.toFixed(1)}
              </p>
              <p className="text-xs text-zinc-500">
                {stats.reviewCount} review{stats.reviewCount !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        )}

        {stats?.soldCount !== undefined && stats.soldCount > 0 && (
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-green-400" />
            <div>
              <p className="text-sm font-medium text-white">{stats.soldCount}</p>
              <p className="text-xs text-zinc-500">Sold</p>
            </div>
          </div>
        )}
      </div>

      {/* Member since */}
      <div className="flex items-center gap-2 text-sm text-zinc-400">
        <Clock className="w-4 h-4" />
        <span>{formatMemberSince(seller.createdAt)}</span>
      </div>

      {/* Reputation */}
      {seller.reputation !== undefined && seller.reputation > 0 && (
        <div className="px-3 py-2 bg-zinc-800 rounded-lg">
          <p className="text-xs text-zinc-500">Forum Reputation</p>
          <p className="text-lg font-bold text-violet-400">
            +{seller.reputation.toLocaleString()}
          </p>
        </div>
      )}

      {/* Message Button */}
      {showMessageButton && (
        <button
          onClick={onMessage}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
        >
          <MessageSquare className="w-4 h-4" />
          Message Seller
        </button>
      )}
    </div>
  );
}
