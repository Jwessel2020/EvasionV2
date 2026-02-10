'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Upload,
  X,
  Plus,
  Loader2,
  ImageIcon,
  DollarSign,
  MapPin,
  Truck,
  Car,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { LISTING_CATEGORIES, LISTING_CONDITIONS } from '@/lib/marketplace/constants';

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
];

interface Vehicle {
  make: string;
  model?: string;
  yearMin?: string;
  yearMax?: string;
}

interface UploadedImage {
  url: string;
  thumbnail?: string;
  uploading?: boolean;
  file?: File;
}

export default function CreateListingPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(1);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [condition, setCondition] = useState('');
  const [price, setPrice] = useState('');
  const [originalPrice, setOriginalPrice] = useState('');
  const [priceNegotiable, setPriceNegotiable] = useState(false);
  const [acceptsOffers, setAcceptsOffers] = useState(true);
  const [brand, setBrand] = useState('');
  const [partNumber, setPartNumber] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [location, setLocation] = useState({ city: '', state: '' });
  const [shipping, setShipping] = useState({
    localPickup: true,
    willShip: false,
    freeShipping: false,
    shippingCost: '',
  });
  const [compatibility, setCompatibility] = useState({
    universal: false,
    vehicles: [] as Vehicle[],
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Add placeholders
    const newImages = files.map((file) => ({
      url: URL.createObjectURL(file),
      uploading: true,
      file,
    }));

    setImages((prev) => [...prev, ...newImages]);

    // Upload each file
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'marketplace');

      try {
        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (res.ok) {
          const data = await res.json();
          setImages((prev) =>
            prev.map((img) =>
              img.file === file
                ? { url: data.url, thumbnail: data.thumbnailUrl, uploading: false }
                : img
            )
          );
        }
      } catch (error) {
        console.error('Upload error:', error);
        setImages((prev) => prev.filter((img) => img.file !== file));
      }
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const addVehicle = () => {
    setCompatibility((prev) => ({
      ...prev,
      vehicles: [...prev.vehicles, { make: '', model: '', yearMin: '', yearMax: '' }],
    }));
  };

  const updateVehicle = (index: number, updates: Partial<Vehicle>) => {
    setCompatibility((prev) => ({
      ...prev,
      vehicles: prev.vehicles.map((v, i) => (i === index ? { ...v, ...updates } : v)),
    }));
  };

  const removeVehicle = (index: number) => {
    setCompatibility((prev) => ({
      ...prev,
      vehicles: prev.vehicles.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (asDraft = false) => {
    if (submitting) return;
    setSubmitting(true);

    try {
      const listingData = {
        title,
        description,
        category,
        condition,
        price: parseFloat(price),
        originalPrice: originalPrice ? parseFloat(originalPrice) : undefined,
        priceNegotiable,
        acceptsOffers,
        brand: brand || undefined,
        partNumber: partNumber || undefined,
        quantity: parseInt(quantity),
        images: images.filter((img) => !img.uploading).map((img) => ({
          url: img.url,
          thumbnail: img.thumbnail,
        })),
        location: {
          city: location.city || undefined,
          state: location.state || undefined,
          country: 'US',
        },
        shipping: {
          localPickup: shipping.localPickup,
          willShip: shipping.willShip,
          freeShipping: shipping.freeShipping,
          shippingCost: shipping.shippingCost ? parseFloat(shipping.shippingCost) : undefined,
          shipsTo: shipping.willShip ? ['US'] : [],
        },
        compatibility: compatibility.universal
          ? { universal: true, vehicles: [] }
          : {
              universal: false,
              vehicles: compatibility.vehicles
                .filter((v) => v.make)
                .map((v) => ({
                  make: v.make,
                  model: v.model || undefined,
                  yearMin: v.yearMin ? parseInt(v.yearMin) : undefined,
                  yearMax: v.yearMax ? parseInt(v.yearMax) : undefined,
                })),
            },
        status: asDraft ? 'draft' : 'active',
      };

      const res = await fetch('/api/marketplace/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(listingData),
      });

      const data = await res.json();

      if (data.success) {
        router.push(`/marketplace/${data.data.slug}`);
      } else {
        alert(data.error || 'Failed to create listing');
      }
    } catch (error) {
      console.error('Error creating listing:', error);
      alert('Failed to create listing');
    } finally {
      setSubmitting(false);
    }
  };

  const canProceed = () => {
    if (step === 1) return title.length >= 5 && category && condition;
    if (step === 2) return images.filter((i) => !i.uploading).length >= 1;
    if (step === 3) return parseFloat(price) > 0;
    return true;
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => router.back()}
          className="p-2 text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white">Create Listing</h1>
          <p className="text-sm text-zinc-400">Step {step} of 4</p>
        </div>
      </div>

      {/* Progress */}
      <div className="flex gap-2 mb-8">
        {[1, 2, 3, 4].map((s) => (
          <div
            key={s}
            className={cn(
              'h-1 flex-1 rounded-full transition-colors',
              s <= step ? 'bg-red-500' : 'bg-zinc-800'
            )}
          />
        ))}
      </div>

      {/* Step 1: Basic Info */}
      {step === 1 && (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., OEM Honda Civic Type R Exhaust"
              maxLength={150}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <p className="mt-1 text-xs text-zinc-500">{title.length}/150</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Category *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {LISTING_CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setCategory(cat.value)}
                  className={cn(
                    'p-3 rounded-lg border text-sm font-medium transition-colors',
                    category === cat.value
                      ? 'bg-red-600 border-red-500 text-white'
                      : 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:border-zinc-600'
                  )}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Condition *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {LISTING_CONDITIONS.map((cond) => (
                <button
                  key={cond.value}
                  type="button"
                  onClick={() => setCondition(cond.value)}
                  className={cn(
                    'p-3 rounded-lg border text-sm font-medium transition-colors',
                    condition === cond.value
                      ? 'bg-red-600 border-red-500 text-white'
                      : 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:border-zinc-600'
                  )}
                >
                  {cond.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Description *
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your item in detail..."
              rows={5}
              maxLength={5000}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
            />
            <p className="mt-1 text-xs text-zinc-500">{description.length}/5000</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Brand
              </label>
              <input
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="e.g., OEM, Borla, K&N"
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Part Number
              </label>
              <input
                type="text"
                value={partNumber}
                onChange={(e) => setPartNumber(e.target.value)}
                placeholder="e.g., 18310-TGH-A01"
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Images */}
      {step === 2 && (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Photos * (minimum 1, up to 10)
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-4">
              {images.map((img, i) => (
                <div
                  key={i}
                  className="relative aspect-square bg-zinc-800 rounded-lg overflow-hidden"
                >
                  <img
                    src={img.url}
                    alt={`Image ${i + 1}`}
                    className="w-full h-full object-cover"
                  />
                  {img.uploading && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <Loader2 className="w-6 h-6 text-white animate-spin" />
                    </div>
                  )}
                  <button
                    onClick={() => removeImage(i)}
                    className="absolute top-1 right-1 p-1 bg-black/50 rounded-full text-white hover:bg-black/70"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  {i === 0 && (
                    <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-red-500 text-white text-xs rounded">
                      Cover
                    </div>
                  )}
                </div>
              ))}
              {images.length < 10 && (
                <label className="aspect-square border-2 border-dashed border-zinc-700 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-zinc-600 transition-colors">
                  <Upload className="w-8 h-8 text-zinc-500 mb-2" />
                  <span className="text-xs text-zinc-500">Add Photo</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Pricing & Location */}
      {step === 3 && (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              <DollarSign className="w-4 h-4 inline mr-1" />
              Price *
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400">$</span>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg pl-8 pr-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Original Price (optional, for sale items)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400">$</span>
              <input
                type="number"
                value={originalPrice}
                onChange={(e) => setOriginalPrice(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg pl-8 pr-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={priceNegotiable}
                onChange={(e) => setPriceNegotiable(e.target.checked)}
                className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-red-500"
              />
              <span className="text-sm text-zinc-300">Price is negotiable</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptsOffers}
                onChange={(e) => setAcceptsOffers(e.target.checked)}
                className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-red-500"
              />
              <span className="text-sm text-zinc-300">Accept offers</span>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                <MapPin className="w-4 h-4 inline mr-1" />
                City
              </label>
              <input
                type="text"
                value={location.city}
                onChange={(e) => setLocation({ ...location, city: e.target.value })}
                placeholder="e.g., Los Angeles"
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                State
              </label>
              <select
                value={location.state}
                onChange={(e) => setLocation({ ...location, state: e.target.value })}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="">Select state</option>
                {US_STATES.map((state) => (
                  <option key={state} value={state}>{state}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              <Truck className="w-4 h-4 inline mr-1" />
              Shipping Options
            </label>
            <div className="space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={shipping.localPickup}
                  onChange={(e) => setShipping({ ...shipping, localPickup: e.target.checked })}
                  className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-red-500"
                />
                <span className="text-sm text-zinc-300">Local pickup available</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={shipping.willShip}
                  onChange={(e) => setShipping({ ...shipping, willShip: e.target.checked })}
                  className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-red-500"
                />
                <span className="text-sm text-zinc-300">Will ship</span>
              </label>
              {shipping.willShip && (
                <div className="ml-6 space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={shipping.freeShipping}
                      onChange={(e) => setShipping({ ...shipping, freeShipping: e.target.checked })}
                      className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-green-500"
                    />
                    <span className="text-sm text-green-400">Free shipping</span>
                  </label>
                  {!shipping.freeShipping && (
                    <div className="relative w-48">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400">$</span>
                      <input
                        type="number"
                        value={shipping.shippingCost}
                        onChange={(e) => setShipping({ ...shipping, shippingCost: e.target.value })}
                        placeholder="Shipping cost"
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-lg pl-8 pr-4 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Vehicle Compatibility */}
      {step === 4 && (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              <Car className="w-4 h-4 inline mr-1" />
              Vehicle Compatibility
            </label>

            <label className="flex items-center gap-2 cursor-pointer mb-4">
              <input
                type="checkbox"
                checked={compatibility.universal}
                onChange={(e) => setCompatibility({ ...compatibility, universal: e.target.checked })}
                className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-green-500"
              />
              <span className="text-sm text-zinc-300">Universal fit (works with most vehicles)</span>
            </label>

            {!compatibility.universal && (
              <div className="space-y-3">
                {compatibility.vehicles.map((vehicle, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      type="text"
                      value={vehicle.make}
                      onChange={(e) => updateVehicle(i, { make: e.target.value })}
                      placeholder="Make (e.g., Honda)"
                      className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                    <input
                      type="text"
                      value={vehicle.model || ''}
                      onChange={(e) => updateVehicle(i, { model: e.target.value })}
                      placeholder="Model"
                      className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                    <input
                      type="number"
                      value={vehicle.yearMin || ''}
                      onChange={(e) => updateVehicle(i, { yearMin: e.target.value })}
                      placeholder="From"
                      className="w-20 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                    <input
                      type="number"
                      value={vehicle.yearMax || ''}
                      onChange={(e) => updateVehicle(i, { yearMax: e.target.value })}
                      placeholder="To"
                      className="w-20 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                    <button
                      onClick={() => removeVehicle(i)}
                      className="p-2 text-zinc-400 hover:text-red-400"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={addVehicle}
                  className="flex items-center gap-2 text-sm text-red-500 hover:text-red-400"
                >
                  <Plus className="w-4 h-4" />
                  Add vehicle
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Quantity Available
            </label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              min="1"
              className="w-32 bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between mt-8 pt-6 border-t border-zinc-800">
        {step > 1 ? (
          <button
            onClick={() => setStep(step - 1)}
            className="px-6 py-2 text-zinc-400 hover:text-white transition-colors"
          >
            Back
          </button>
        ) : (
          <div />
        )}

        <div className="flex gap-3">
          {step === 4 && (
            <button
              onClick={() => handleSubmit(true)}
              disabled={submitting}
              className="px-6 py-2 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 rounded-lg disabled:opacity-50 transition-colors"
            >
              Save as Draft
            </button>
          )}
          {step < 4 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={!canProceed()}
              className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Continue
            </button>
          ) : (
            <button
              onClick={() => handleSubmit(false)}
              disabled={submitting || !canProceed()}
              className="flex items-center gap-2 px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Publish Listing
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
