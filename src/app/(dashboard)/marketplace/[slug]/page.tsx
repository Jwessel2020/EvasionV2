'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Heart,
  Share2,
  Flag,
  MapPin,
  Truck,
  Clock,
  Eye,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  Store,
  Shield,
  Star,
  Car,
} from 'lucide-react';
import { ConditionBadge, PriceDisplay, SellerCard, SaveButton } from '@/components/marketplace';
import { cn } from '@/lib/utils';
import { LISTING_CATEGORIES } from '@/lib/marketplace/constants';

interface ListingPageProps {
  params: Promise<{ slug: string }>;
}

interface Listing {
  _id: string;
  title: string;
  slug: string;
  description: string;
  price: number;
  originalPrice?: number;
  condition: string;
  category: string;
  brand?: string;
  partNumber?: string;
  quantity: number;
  images: { url: string; thumbnail?: string }[];
  videos?: { url: string; provider: string }[];
  location?: { city?: string; state?: string; country?: string };
  shipping?: {
    localPickup?: boolean;
    willShip?: boolean;
    freeShipping?: boolean;
    shippingCost?: number;
    shipsTo?: string[];
  };
  compatibility?: {
    universal: boolean;
    vehicles: { make: string; model?: string; year?: number; yearMin?: number; yearMax?: number }[];
  };
  sellerUsername: string;
  sellerAvatar?: string;
  isFeatured?: boolean;
  priceNegotiable?: boolean;
  acceptsOffers?: boolean;
  viewCount: number;
  saveCount: number;
  createdAt: string;
  seller?: {
    _id: string;
    username: string;
    displayName?: string;
    avatar?: string;
    reputation?: number;
    createdAt: string;
    marketplaceStats?: {
      averageRating?: number;
      reviewCount?: number;
      soldCount?: number;
    };
  };
  shop?: {
    name: string;
    slug: string;
    logo?: string;
    isVerified: boolean;
    averageRating: number;
    reviewCount: number;
  };
  isSaved?: boolean;
  moreFromSeller?: Listing[];
  similarListings?: Listing[];
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function ListingPage({ params }: ListingPageProps) {
  const { slug } = use(params);
  const router = useRouter();
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentImage, setCurrentImage] = useState(0);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchListing();
  }, [slug]);

  const fetchListing = async () => {
    try {
      const res = await fetch(`/api/marketplace/listings/${slug}`);
      const data = await res.json();

      if (data.success) {
        setListing(data.data);
      } else {
        router.push('/marketplace');
      }
    } catch (error) {
      console.error('Error fetching listing:', error);
      router.push('/marketplace');
    } finally {
      setLoading(false);
    }
  };

  const handleMessage = async () => {
    if (!message.trim() || !listing?.seller || sending) return;

    setSending(true);
    try {
      const res = await fetch('/api/marketplace/messages/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientId: listing.seller._id,
          listingId: listing._id,
          message: message.trim(),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        router.push(`/marketplace/messages/${data.data.conversation._id}`);
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({
        title: listing?.title,
        url: window.location.href,
      });
    } else {
      await navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="text-center py-20">
        <h1 className="text-2xl font-bold text-white mb-4">Listing not found</h1>
        <Link href="/marketplace" className="text-red-500 hover:text-red-400">
          Back to marketplace
        </Link>
      </div>
    );
  }

  const categoryData = LISTING_CATEGORIES.find((c) => c.value === listing.category);
  const locationText = [listing.location?.city, listing.location?.state]
    .filter(Boolean)
    .join(', ');

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Back Button */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-zinc-400 hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Left Column - Images & Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Image Gallery */}
          <div className="bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800">
            {/* Main Image */}
            <div className="relative aspect-[4/3] bg-zinc-800">
              {listing.images.length > 0 ? (
                <img
                  src={listing.images[currentImage].url}
                  alt={listing.title}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-600">
                  No images
                </div>
              )}

              {/* Navigation Arrows */}
              {listing.images.length > 1 && (
                <>
                  <button
                    onClick={() => setCurrentImage((prev) => (prev > 0 ? prev - 1 : listing.images.length - 1))}
                    className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-black/50 rounded-full text-white hover:bg-black/70 transition-colors"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <button
                    onClick={() => setCurrentImage((prev) => (prev < listing.images.length - 1 ? prev + 1 : 0))}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-black/50 rounded-full text-white hover:bg-black/70 transition-colors"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                </>
              )}

              {/* Image Counter */}
              {listing.images.length > 1 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 bg-black/50 rounded-full text-white text-sm">
                  {currentImage + 1} / {listing.images.length}
                </div>
              )}
            </div>

            {/* Thumbnails */}
            {listing.images.length > 1 && (
              <div className="flex gap-2 p-4 overflow-x-auto">
                {listing.images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentImage(i)}
                    className={cn(
                      'w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden border-2 transition-colors',
                      currentImage === i
                        ? 'border-red-500'
                        : 'border-transparent hover:border-zinc-600'
                    )}
                  >
                    <img
                      src={img.thumbnail || img.url}
                      alt={`${listing.title} ${i + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Description */}
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
            <h2 className="text-lg font-bold text-white mb-4">Description</h2>
            <div className="prose prose-invert prose-sm max-w-none">
              <p className="text-zinc-300 whitespace-pre-wrap">{listing.description}</p>
            </div>
          </div>

          {/* Vehicle Compatibility */}
          {listing.compatibility && (listing.compatibility.universal || listing.compatibility.vehicles.length > 0) && (
            <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Car className="w-5 h-5 text-red-500" />
                Vehicle Compatibility
              </h2>
              {listing.compatibility.universal ? (
                <p className="text-zinc-300">Universal fit - works with most vehicles</p>
              ) : (
                <div className="space-y-2">
                  {listing.compatibility.vehicles.map((vehicle, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 text-zinc-300"
                    >
                      <span className="w-2 h-2 bg-green-500 rounded-full" />
                      {[
                        vehicle.yearMin && vehicle.yearMax
                          ? `${vehicle.yearMin}-${vehicle.yearMax}`
                          : vehicle.year,
                        vehicle.make,
                        vehicle.model,
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Specifications */}
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
            <h2 className="text-lg font-bold text-white mb-4">Details</h2>
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-sm text-zinc-500">Category</dt>
                <dd className="text-white">{categoryData?.label || listing.category}</dd>
              </div>
              <div>
                <dt className="text-sm text-zinc-500">Condition</dt>
                <dd><ConditionBadge condition={listing.condition} size="sm" /></dd>
              </div>
              {listing.brand && (
                <div>
                  <dt className="text-sm text-zinc-500">Brand</dt>
                  <dd className="text-white">{listing.brand}</dd>
                </div>
              )}
              {listing.partNumber && (
                <div>
                  <dt className="text-sm text-zinc-500">Part Number</dt>
                  <dd className="text-white font-mono">{listing.partNumber}</dd>
                </div>
              )}
              {listing.quantity > 1 && (
                <div>
                  <dt className="text-sm text-zinc-500">Quantity</dt>
                  <dd className="text-white">{listing.quantity} available</dd>
                </div>
              )}
              <div>
                <dt className="text-sm text-zinc-500">Listed</dt>
                <dd className="text-white">{formatDate(listing.createdAt)}</dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Right Column - Price & Seller */}
        <div className="space-y-6">
          {/* Price Card */}
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6 space-y-4 sticky top-20">
            {/* Featured Badge */}
            {listing.isFeatured && (
              <div className="inline-flex items-center gap-1 px-2 py-1 bg-amber-500/20 text-amber-400 text-sm rounded">
                <Star className="w-4 h-4" />
                Featured
              </div>
            )}

            {/* Title */}
            <h1 className="text-xl font-bold text-white">{listing.title}</h1>

            {/* Price */}
            <PriceDisplay
              price={listing.price}
              originalPrice={listing.originalPrice}
              size="xl"
            />

            {/* Price badges */}
            <div className="flex flex-wrap gap-2">
              {listing.priceNegotiable && (
                <span className="px-2 py-1 bg-zinc-800 text-zinc-300 text-xs rounded">
                  Negotiable
                </span>
              )}
              {listing.acceptsOffers && (
                <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded">
                  Accepts Offers
                </span>
              )}
            </div>

            {/* Location & Shipping */}
            <div className="space-y-2 pt-4 border-t border-zinc-800">
              {locationText && (
                <div className="flex items-center gap-2 text-sm text-zinc-400">
                  <MapPin className="w-4 h-4" />
                  {locationText}
                </div>
              )}
              {listing.shipping?.freeShipping && (
                <div className="flex items-center gap-2 text-sm text-green-400">
                  <Truck className="w-4 h-4" />
                  Free Shipping
                </div>
              )}
              {listing.shipping?.localPickup && (
                <div className="flex items-center gap-2 text-sm text-zinc-400">
                  <MapPin className="w-4 h-4" />
                  Local Pickup Available
                </div>
              )}
            </div>

            {/* Stats */}
            <div className="flex items-center gap-4 pt-4 border-t border-zinc-800 text-sm text-zinc-500">
              <span className="flex items-center gap-1">
                <Eye className="w-4 h-4" />
                {listing.viewCount} views
              </span>
              <span className="flex items-center gap-1">
                <Heart className="w-4 h-4" />
                {listing.saveCount} saved
              </span>
            </div>

            {/* Actions */}
            <div className="space-y-3 pt-4">
              <button
                onClick={() => setShowMessageModal(true)}
                className="w-full flex items-center justify-center gap-2 py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
              >
                <MessageSquare className="w-5 h-5" />
                Message Seller
              </button>

              <div className="flex gap-3">
                <SaveButton
                  listingId={listing._id}
                  initialSaved={listing.isSaved}
                  showText
                  size="md"
                />
                <button
                  onClick={handleShare}
                  className="flex items-center gap-2 px-4 py-2 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 rounded-lg transition-colors"
                >
                  <Share2 className="w-5 h-5" />
                  Share
                </button>
              </div>
            </div>
          </div>

          {/* Seller Card */}
          {listing.shop ? (
            <Link
              href={`/marketplace/shop/${listing.shop.slug}`}
              className="block bg-zinc-900 rounded-xl border border-zinc-800 p-4 hover:border-zinc-700 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-zinc-800 overflow-hidden flex items-center justify-center">
                  {listing.shop.logo ? (
                    <img src={listing.shop.logo} alt={listing.shop.name} className="w-full h-full object-cover" />
                  ) : (
                    <Store className="w-6 h-6 text-zinc-400" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-1">
                    <span className="font-bold text-white">{listing.shop.name}</span>
                    {listing.shop.isVerified && (
                      <Shield className="w-4 h-4 text-blue-400" />
                    )}
                  </div>
                  {listing.shop.reviewCount > 0 && (
                    <div className="flex items-center gap-1 text-sm text-zinc-400">
                      <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                      {listing.shop.averageRating.toFixed(1)} ({listing.shop.reviewCount})
                    </div>
                  )}
                </div>
              </div>
            </Link>
          ) : listing.seller && (
            <SellerCard
              seller={listing.seller}
              onMessage={() => setShowMessageModal(true)}
            />
          )}

          {/* Report */}
          <button className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
            <Flag className="w-4 h-4" />
            Report this listing
          </button>
        </div>
      </div>

      {/* Message Modal */}
      {showMessageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowMessageModal(false)}
          />
          <div className="relative bg-zinc-900 rounded-xl border border-zinc-800 p-6 w-full max-w-lg">
            <h2 className="text-lg font-bold text-white mb-4">
              Message about "{listing.title}"
            </h2>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Hi, I'm interested in this item..."
              rows={4}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setShowMessageModal(false)}
                className="px-4 py-2 text-zinc-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleMessage}
                disabled={!message.trim() || sending}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {sending ? 'Sending...' : 'Send Message'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
