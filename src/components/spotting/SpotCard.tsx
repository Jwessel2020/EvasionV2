'use client';

import { useState } from 'react';
import { Heart, MessageCircle, Eye, MapPin, Play, ExternalLink } from 'lucide-react';
import Link from 'next/link';

interface SpotCardProps {
  spot: {
    id: string;
    make?: string;
    model?: string;
    color?: string;
    year?: number;
    photos: string[];
    videoUrl?: string;
    description?: string;
    latitude: number;
    longitude: number;
    spottedAt: string;
    threadId?: string;
    likeCount?: number;
    viewCount?: number;
    spotter: {
      id: string;
      username: string;
      avatar?: string;
    };
  };
  onLike?: (id: string) => void;
  onMapClick?: (lat: number, lng: number) => void;
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

  return date.toLocaleDateString();
}

function formatNumber(num: number | undefined | null): string {
  if (num == null) return '0';
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

export function SpotCard({ spot, onLike, onMapClick }: SpotCardProps) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(spot.likeCount ?? 0);
  const [showVideo, setShowVideo] = useState(false);

  const handleLike = async () => {
    setLiked(!liked);
    setLikeCount((prev) => (liked ? prev - 1 : prev + 1));

    try {
      await fetch(`/api/car-spotting/${spot.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: liked ? 'unlike' : 'like' }),
      });
      onLike?.(spot.id);
    } catch {
      // Revert on error
      setLiked(liked);
      setLikeCount((prev) => (liked ? prev + 1 : prev - 1));
    }
  };

  const carTitle = [spot.year, spot.make, spot.model].filter(Boolean).join(' ');
  const hasMedia = spot.photos.length > 0 || spot.videoUrl;

  return (
    <div className="bg-zinc-800 rounded-xl overflow-hidden border border-zinc-700 hover:border-zinc-600 transition-colors">
      {/* Media Section */}
      {hasMedia && (
        <div className="relative aspect-video bg-zinc-900">
          {spot.videoUrl && showVideo ? (
            <video
              src={spot.videoUrl}
              controls
              autoPlay
              className="w-full h-full object-contain"
            />
          ) : spot.photos[0] ? (
            <>
              <img
                src={spot.photos[0]}
                alt={carTitle || 'Car spotting'}
                className="w-full h-full object-cover"
              />
              {spot.videoUrl && (
                <button
                  onClick={() => setShowVideo(true)}
                  className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors"
                >
                  <div className="w-16 h-16 flex items-center justify-center bg-white/20 backdrop-blur rounded-full">
                    <Play className="w-8 h-8 text-white fill-white ml-1" />
                  </div>
                </button>
              )}
              {spot.photos.length > 1 && (
                <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/50 rounded text-xs">
                  +{spot.photos.length - 1} more
                </div>
              )}
            </>
          ) : spot.videoUrl ? (
            <video
              src={spot.videoUrl}
              controls
              className="w-full h-full object-contain"
            />
          ) : null}

          {/* Color indicator */}
          {spot.color && (
            <div
              className="absolute top-2 left-2 w-6 h-6 rounded-full border-2 border-white shadow"
              style={{
                backgroundColor:
                  {
                    red: '#ef4444',
                    blue: '#3b82f6',
                    green: '#22c55e',
                    yellow: '#eab308',
                    orange: '#f97316',
                    purple: '#a855f7',
                    pink: '#ec4899',
                    white: '#f8fafc',
                    black: '#1f2937',
                    gray: '#6b7280',
                    silver: '#94a3b8',
                    gold: '#fbbf24',
                    brown: '#92400e',
                  }[spot.color.toLowerCase()] || '#6b7280',
              }}
              title={spot.color}
            />
          )}
        </div>
      )}

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Title and location */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold text-lg">
              {carTitle || 'Unknown Car'}
            </h3>
            <button
              onClick={() => onMapClick?.(spot.latitude, spot.longitude)}
              className="flex items-center gap-1 text-sm text-zinc-400 hover:text-violet-400 transition-colors"
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>{formatTimeAgo(spot.spottedAt)}</span>
            </button>
          </div>
          {spot.threadId && (
            <Link
              href={`/forums/threads/${spot.threadId}`}
              className="p-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg transition-colors"
              title="View discussion"
            >
              <ExternalLink className="w-4 h-4" />
            </Link>
          )}
        </div>

        {/* Description */}
        {spot.description && (
          <p className="text-sm text-zinc-300 line-clamp-2">{spot.description}</p>
        )}

        {/* Spotter info */}
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <div className="w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center overflow-hidden">
            {spot.spotter.avatar ? (
              <img
                src={spot.spotter.avatar}
                alt={spot.spotter.username}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-xs font-medium">
                {spot.spotter.username.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <span>@{spot.spotter.username}</span>
        </div>

        {/* Engagement stats */}
        <div className="flex items-center gap-4 pt-2 border-t border-zinc-700">
          <button
            onClick={handleLike}
            className={`flex items-center gap-1.5 text-sm transition-colors ${
              liked ? 'text-red-500' : 'text-zinc-400 hover:text-red-400'
            }`}
          >
            <Heart className={`w-4 h-4 ${liked ? 'fill-current' : ''}`} />
            <span>{formatNumber(likeCount)}</span>
          </button>

          {spot.threadId && (
            <Link
              href={`/forums/threads/${spot.threadId}`}
              className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-violet-400 transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Discuss</span>
            </Link>
          )}

          <div className="flex items-center gap-1.5 text-sm text-zinc-500 ml-auto">
            <Eye className="w-4 h-4" />
            <span>{formatNumber(spot.viewCount)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
