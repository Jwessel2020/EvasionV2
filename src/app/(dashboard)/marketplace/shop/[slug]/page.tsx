'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import {
  Store, MapPin, Star, MessageCircle, Share2, Shield, Clock,
  Package, Heart, Calendar, ExternalLink, Phone, Mail, Globe
} from 'lucide-react';
import { ListingCard } from '@/components/marketplace/ListingCard';
import { cn } from '@/lib/utils';

interface Shop {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  logo?: string;
  banner?: string;
  businessType: 'individual' | 'business';
  categories: string[];
  brands: string[];
  vehicleFocus: string[];
  contact?: {
    email?: string;
    phone?: string;
    website?: string;
  };
  location?: {
    city?: string;
    state?: string;
    country?: string;
  };
  isVerified: boolean;
  verifiedAt?: string;
  listingCount: number;
  activeListings: number;
  soldCount: number;
  totalSales: number;
  averageRating: number;
  reviewCount: number;
  followerCount: number;
  responseRate?: number;
  responseTime?: string;
  createdAt: string;
}

interface Listing {
  _id: string;
  title: string;
  slug: string;
  price: number;
  originalPrice?: number;
  condition: string;
  category: string;
  images: { url: string; thumbnail?: string }[];
  location?: { city?: string; state?: string };
  shipping?: { freeShipping?: boolean; localPickup?: boolean };
  sellerUsername: string;
  shopName?: string;
  shopSlug?: string;
  isFeatured?: boolean;
  viewCount?: number;
  saveCount?: number;
  createdAt: string;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

export default function ShopStorefrontPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [shop, setShop] = useState<Shop | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'listings' | 'about' | 'reviews'>('listings');
  const [sortBy, setSortBy] = useState('newest');

  useEffect(() => {
    fetchShop();
  }, [slug]);

  useEffect(() => {
    if (shop) {
      fetchListings();
    }
  }, [shop, sortBy]);

  const fetchShop = async () => {
    try {
      const res = await fetch(`/api/marketplace/shops/${slug}`);
      const data = await res.json();

      if (data.success) {
        setShop(data.data.shop);
        setFollowing(data.data.isFollowing);
      } else {
        setError(data.error || 'Shop not found');
      }
    } catch (err) {
      setError('Failed to load shop');
    } finally {
      setLoading(false);
    }
  };

  const fetchListings = async () => {
    if (!shop) return;

    try {
      const res = await fetch(
        `/api/marketplace/shops/${slug}/listings?sort=${sortBy}&limit=50`
      );
      const data = await res.json();

      if (data.success) {
        setListings(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch listings:', err);
    }
  };

  const handleFollow = async () => {
    if (followLoading) return;
    setFollowLoading(true);

    try {
      const res = await fetch(`/api/marketplace/shops/${slug}/follow`, {
        method: following ? 'DELETE' : 'POST',
      });
      const data = await res.json();

      if (data.success) {
        setFollowing(!following);
        if (shop) {
          setShop({
            ...shop,
            followerCount: shop.followerCount + (following ? -1 : 1),
          });
        }
      }
    } catch (err) {
      console.error('Follow error:', err);
    } finally {
      setFollowLoading(false);
    }
  };

  const handleShare = async () => {
    try {
      await navigator.share({
        title: shop?.name,
        text: shop?.description || `Check out ${shop?.name} on Evasion Marketplace`,
        url: window.location.href,
      });
    } catch {
      navigator.clipboard.writeText(window.location.href);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-zinc-400">Loading shop...</p>
        </div>
      </div>
    );
  }

  if (error || !shop) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <Store className="w-16 h-16 text-zinc-600 mx-auto" />
          <h1 className="text-2xl font-bold text-white">Shop Not Found</h1>
          <p className="text-zinc-400">{error || 'This shop does not exist.'}</p>
          <Link
            href="/marketplace"
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Browse Marketplace
          </Link>
        </div>
      </div>
    );
  }

  const locationText = [shop.location?.city, shop.location?.state]
    .filter(Boolean)
    .join(', ');

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="relative h-48 md:h-64 bg-zinc-800 rounded-xl overflow-hidden">
        {shop.banner ? (
          <img
            src={shop.banner}
            alt={`${shop.name} banner`}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-violet-600/20 to-red-600/20" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
      </div>

      {/* Shop Info */}
      <div className="relative -mt-16 px-4 md:px-8">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Logo */}
          <div className="flex-shrink-0">
            <div className="w-32 h-32 bg-zinc-900 border-4 border-zinc-800 rounded-xl overflow-hidden">
              {shop.logo ? (
                <img
                  src={shop.logo}
                  alt={shop.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-violet-600 to-red-600">
                  <Store className="w-12 h-12 text-white" />
                </div>
              )}
            </div>
          </div>

          {/* Details */}
          <div className="flex-grow space-y-3">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl md:text-3xl font-bold text-white">{shop.name}</h1>
                  {shop.isVerified && (
                    <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-sm">
                      <Shield className="w-4 h-4" />
                      Verified
                    </div>
                  )}
                </div>
                <p className="text-zinc-400 capitalize">{shop.businessType}</p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleFollow}
                  disabled={followLoading}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors',
                    following
                      ? 'bg-zinc-700 text-white hover:bg-zinc-600'
                      : 'bg-red-600 text-white hover:bg-red-700'
                  )}
                >
                  <Heart className={cn('w-4 h-4', following && 'fill-current')} />
                  {following ? 'Following' : 'Follow'}
                </button>
                <Link
                  href={`/marketplace/messages?shop=${shop._id}`}
                  className="flex items-center gap-2 px-4 py-2 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700"
                >
                  <MessageCircle className="w-4 h-4" />
                  Contact
                </Link>
                <button
                  onClick={handleShare}
                  className="p-2 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700"
                >
                  <Share2 className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Stats */}
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <div className="flex items-center gap-1 text-zinc-400">
                <Star className="w-4 h-4 text-amber-400" />
                <span className="text-white font-medium">{shop.averageRating.toFixed(1)}</span>
                <span>({shop.reviewCount} reviews)</span>
              </div>
              <div className="flex items-center gap-1 text-zinc-400">
                <Package className="w-4 h-4" />
                <span className="text-white font-medium">{shop.activeListings}</span>
                <span>listings</span>
              </div>
              <div className="flex items-center gap-1 text-zinc-400">
                <Heart className="w-4 h-4" />
                <span className="text-white font-medium">{formatNumber(shop.followerCount)}</span>
                <span>followers</span>
              </div>
              {locationText && (
                <div className="flex items-center gap-1 text-zinc-400">
                  <MapPin className="w-4 h-4" />
                  <span>{locationText}</span>
                </div>
              )}
              <div className="flex items-center gap-1 text-zinc-400">
                <Calendar className="w-4 h-4" />
                <span>Joined {formatDate(shop.createdAt)}</span>
              </div>
            </div>

            {/* Categories & Brands */}
            {(shop.categories.length > 0 || shop.brands.length > 0) && (
              <div className="flex flex-wrap gap-2">
                {shop.categories.map((cat) => (
                  <span
                    key={cat}
                    className="px-2 py-1 bg-violet-500/20 text-violet-400 rounded text-xs"
                  >
                    {cat}
                  </span>
                ))}
                {shop.brands.slice(0, 5).map((brand) => (
                  <span
                    key={brand}
                    className="px-2 py-1 bg-zinc-800 text-zinc-400 rounded text-xs"
                  >
                    {brand}
                  </span>
                ))}
                {shop.brands.length > 5 && (
                  <span className="px-2 py-1 text-zinc-500 text-xs">
                    +{shop.brands.length - 5} more
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-zinc-800">
        <nav className="flex gap-6">
          {(['listings', 'about', 'reviews'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'py-3 px-1 text-sm font-medium border-b-2 transition-colors capitalize',
                activeTab === tab
                  ? 'border-red-500 text-white'
                  : 'border-transparent text-zinc-400 hover:text-white'
              )}
            >
              {tab}
              {tab === 'listings' && ` (${shop.activeListings})`}
              {tab === 'reviews' && ` (${shop.reviewCount})`}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'listings' && (
        <div className="space-y-4">
          {/* Sort */}
          <div className="flex items-center justify-between">
            <p className="text-zinc-400">
              {shop.activeListings} active listings
            </p>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm border border-zinc-700 focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="newest">Newest First</option>
              <option value="priceAsc">Price: Low to High</option>
              <option value="priceDesc">Price: High to Low</option>
              <option value="popular">Most Popular</option>
            </select>
          </div>

          {/* Grid */}
          {listings.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {listings.map((listing) => (
                <ListingCard key={listing._id} listing={listing} compact />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Package className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
              <p className="text-zinc-400">No listings available</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'about' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Description */}
          <div className="md:col-span-2 space-y-6">
            {shop.description && (
              <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
                <h3 className="text-lg font-semibold text-white mb-3">About</h3>
                <p className="text-zinc-300 whitespace-pre-wrap">{shop.description}</p>
              </div>
            )}

            {/* Stats */}
            <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
              <h3 className="text-lg font-semibold text-white mb-4">Shop Stats</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-zinc-800 rounded-lg">
                  <div className="text-2xl font-bold text-white">{shop.soldCount}</div>
                  <div className="text-sm text-zinc-400">Items Sold</div>
                </div>
                <div className="text-center p-4 bg-zinc-800 rounded-lg">
                  <div className="text-2xl font-bold text-white">{shop.activeListings}</div>
                  <div className="text-sm text-zinc-400">Active Listings</div>
                </div>
                <div className="text-center p-4 bg-zinc-800 rounded-lg">
                  <div className="text-2xl font-bold text-white">{shop.averageRating.toFixed(1)}</div>
                  <div className="text-sm text-zinc-400">Average Rating</div>
                </div>
                <div className="text-center p-4 bg-zinc-800 rounded-lg">
                  <div className="text-2xl font-bold text-white">{formatNumber(shop.followerCount)}</div>
                  <div className="text-sm text-zinc-400">Followers</div>
                </div>
              </div>
            </div>

            {/* Vehicle Focus */}
            {shop.vehicleFocus.length > 0 && (
              <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
                <h3 className="text-lg font-semibold text-white mb-3">Specializes In</h3>
                <div className="flex flex-wrap gap-2">
                  {shop.vehicleFocus.map((vehicle) => (
                    <span
                      key={vehicle}
                      className="px-3 py-1.5 bg-zinc-800 text-zinc-300 rounded-lg text-sm"
                    >
                      {vehicle}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Contact Info */}
          <div className="space-y-4">
            <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
              <h3 className="text-lg font-semibold text-white mb-4">Contact</h3>
              <div className="space-y-3">
                {shop.contact?.email && (
                  <a
                    href={`mailto:${shop.contact.email}`}
                    className="flex items-center gap-3 text-zinc-400 hover:text-white"
                  >
                    <Mail className="w-5 h-5" />
                    <span className="text-sm">{shop.contact.email}</span>
                  </a>
                )}
                {shop.contact?.phone && (
                  <a
                    href={`tel:${shop.contact.phone}`}
                    className="flex items-center gap-3 text-zinc-400 hover:text-white"
                  >
                    <Phone className="w-5 h-5" />
                    <span className="text-sm">{shop.contact.phone}</span>
                  </a>
                )}
                {shop.contact?.website && (
                  <a
                    href={shop.contact.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 text-zinc-400 hover:text-white"
                  >
                    <Globe className="w-5 h-5" />
                    <span className="text-sm">Visit Website</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>

            {/* Response Info */}
            <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
              <h3 className="text-lg font-semibold text-white mb-4">Response</h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Response Rate</span>
                  <span className="text-white font-medium">
                    {shop.responseRate ? `${shop.responseRate}%` : 'N/A'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Response Time</span>
                  <span className="text-white font-medium">
                    {shop.responseTime || 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'reviews' && (
        <div className="text-center py-12">
          <Star className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
          <p className="text-zinc-400">Reviews coming soon</p>
          <p className="text-zinc-500 text-sm mt-2">
            {shop.reviewCount} reviews with {shop.averageRating.toFixed(1)} average rating
          </p>
        </div>
      )}
    </div>
  );
}
