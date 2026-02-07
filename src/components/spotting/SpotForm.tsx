'use client';

import { useState, useRef, useEffect } from 'react';
import { Camera, Video, MapPin, X, Loader2, Car } from 'lucide-react';

interface SpotFormProps {
  onSubmit: (data: SpotFormData) => Promise<void>;
  onCancel?: () => void;
  isSubmitting?: boolean;
}

export interface SpotFormData {
  photos: string[];
  videoUrl?: string;
  make: string;
  model: string;
  color?: string;
  year?: number;
  description: string;
  latitude: number;
  longitude: number;
}

const CAR_COLORS = [
  { name: 'Red', value: 'red', hex: '#ef4444' },
  { name: 'Blue', value: 'blue', hex: '#3b82f6' },
  { name: 'Green', value: 'green', hex: '#22c55e' },
  { name: 'Yellow', value: 'yellow', hex: '#eab308' },
  { name: 'Orange', value: 'orange', hex: '#f97316' },
  { name: 'Purple', value: 'purple', hex: '#a855f7' },
  { name: 'Pink', value: 'pink', hex: '#ec4899' },
  { name: 'White', value: 'white', hex: '#f8fafc' },
  { name: 'Black', value: 'black', hex: '#1f2937' },
  { name: 'Gray', value: 'gray', hex: '#6b7280' },
  { name: 'Silver', value: 'silver', hex: '#94a3b8' },
  { name: 'Gold', value: 'gold', hex: '#fbbf24' },
  { name: 'Brown', value: 'brown', hex: '#92400e' },
];

export function SpotForm({ onSubmit, onCancel, isSubmitting = false }: SpotFormProps) {
  const [photos, setPhotos] = useState<string[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [color, setColor] = useState('');
  const [year, setYear] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationName, setLocationName] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Auto-detect location on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          setLocation({ lat: latitude, lng: longitude });

          // Reverse geocode to get location name (simplified)
          try {
            const res = await fetch(
              `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}&types=place,locality,neighborhood`
            );
            const data = await res.json();
            if (data.features?.length > 0) {
              setLocationName(data.features[0].place_name);
            }
          } catch {
            setLocationName(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
          }
        },
        () => {
          setError('Could not get your location. Please enable location services.');
        }
      );
    }
  }, []);

  // Upload file to server
  const uploadFile = async (file: File): Promise<string | null> => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        return data.url;
      } else {
        throw new Error(data.error || 'Upload failed');
      }
    } catch (err) {
      console.error('Upload error:', err);
      return null;
    }
  };

  // Handle photo selection
  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    setUploading(true);
    setError(null);

    const newPhotos: string[] = [];
    for (const file of Array.from(files)) {
      const url = await uploadFile(file);
      if (url) {
        newPhotos.push(url);
      }
    }

    setPhotos((prev) => [...prev, ...newPhotos]);
    setUploading(false);

    // Reset input
    if (photoInputRef.current) {
      photoInputRef.current.value = '';
    }
  };

  // Handle video selection
  const handleVideoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check video duration (client-side check)
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = async () => {
      if (video.duration > 60) {
        setError('Video must be under 60 seconds');
        return;
      }

      setUploading(true);
      setError(null);

      const url = await uploadFile(file);
      if (url) {
        setVideoUrl(url);
      }

      setUploading(false);
    };
    video.src = URL.createObjectURL(file);

    // Reset input
    if (videoInputRef.current) {
      videoInputRef.current.value = '';
    }
  };

  // Remove photo
  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  // Remove video
  const removeVideo = () => {
    setVideoUrl(null);
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!location) {
      setError('Location is required. Please enable location services.');
      return;
    }

    if (photos.length === 0 && !videoUrl) {
      setError('Please add at least one photo or video');
      return;
    }

    if (!make.trim() || !model.trim()) {
      setError('Please enter the car make and model');
      return;
    }

    await onSubmit({
      photos,
      videoUrl: videoUrl || undefined,
      make: make.trim(),
      model: model.trim(),
      color: color || undefined,
      year: year ? parseInt(year) : undefined,
      description: description.trim(),
      latitude: location.lat,
      longitude: location.lng,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Media Section */}
      <div className="space-y-4">
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => photoInputRef.current?.click()}
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-zinc-800 hover:bg-zinc-700 rounded-lg border border-zinc-700 transition-colors"
            disabled={uploading}
          >
            <Camera className="w-5 h-5" />
            <span>Add Photo</span>
          </button>
          <button
            type="button"
            onClick={() => videoInputRef.current?.click()}
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-zinc-800 hover:bg-zinc-700 rounded-lg border border-zinc-700 transition-colors"
            disabled={uploading || !!videoUrl}
          >
            <Video className="w-5 h-5" />
            <span>Add Video</span>
          </button>
        </div>

        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handlePhotoSelect}
          className="hidden"
          capture="environment"
        />
        <input
          ref={videoInputRef}
          type="file"
          accept="video/*"
          onChange={handleVideoSelect}
          className="hidden"
          capture="environment"
        />

        {/* Upload indicator */}
        {uploading && (
          <div className="flex items-center justify-center gap-2 py-4 text-zinc-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Uploading...</span>
          </div>
        )}

        {/* Photo preview grid */}
        {photos.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {photos.map((url, index) => (
              <div key={url} className="relative aspect-square rounded-lg overflow-hidden">
                <img src={url} alt={`Photo ${index + 1}`} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removePhoto(index)}
                  className="absolute top-1 right-1 p-1 bg-black/50 rounded-full hover:bg-black/70"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Video preview */}
        {videoUrl && (
          <div className="relative aspect-video rounded-lg overflow-hidden bg-zinc-800">
            <video src={videoUrl} controls className="w-full h-full object-contain" />
            <button
              type="button"
              onClick={removeVideo}
              className="absolute top-2 right-2 p-1 bg-black/50 rounded-full hover:bg-black/70"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Car Details */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-zinc-400">
          <Car className="w-5 h-5" />
          <span className="font-medium">Car Details</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <input
            type="text"
            placeholder="Make (e.g., Toyota)"
            value={make}
            onChange={(e) => setMake(e.target.value)}
            className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
            required
          />
          <input
            type="text"
            placeholder="Model (e.g., Supra)"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Color selector */}
          <div className="relative">
            <select
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 appearance-none"
            >
              <option value="">Color</option>
              {CAR_COLORS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.name}
                </option>
              ))}
            </select>
            {color && (
              <div
                className="absolute right-10 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border border-zinc-600"
                style={{ backgroundColor: CAR_COLORS.find((c) => c.value === color)?.hex }}
              />
            )}
          </div>

          <input
            type="number"
            placeholder="Year"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            min="1900"
            max={new Date().getFullYear() + 1}
            className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>

        <textarea
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
        />
      </div>

      {/* Location */}
      <div className="flex items-center gap-2 px-4 py-3 bg-zinc-800 rounded-lg border border-zinc-700">
        <MapPin className="w-5 h-5 text-green-500" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-zinc-400">Location</p>
          <p className="text-sm truncate">
            {locationName || (location ? 'Detecting location...' : 'Location unavailable')}
          </p>
        </div>
        {location && <span className="text-xs text-green-500">Auto-detected</span>}
      </div>

      {/* Error message */}
      {error && (
        <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Submit buttons */}
      <div className="flex gap-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 px-4 bg-zinc-700 hover:bg-zinc-600 rounded-lg transition-colors"
            disabled={isSubmitting}
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting || uploading || !location}
          className="flex-1 py-3 px-4 bg-violet-600 hover:bg-violet-500 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Posting...</span>
            </>
          ) : (
            <span>Post Spot</span>
          )}
        </button>
      </div>
    </form>
  );
}
