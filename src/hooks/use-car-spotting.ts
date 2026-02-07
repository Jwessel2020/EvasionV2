'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { connectSocket, onCarSpotted, reportCarSpotting, type CarSpottingEvent } from '@/lib/socket';

interface CarSpotting {
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
  likeCount: number;
  viewCount: number;
  spotter: {
    id: string;
    username: string;
    avatar?: string;
  };
}

interface UseCarSpottingOptions {
  autoConnect?: boolean;
  bounds?: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  limit?: number;
}

interface UseCarSpottingReturn {
  spots: CarSpotting[];
  loading: boolean;
  error: string | null;
  connected: boolean;
  refresh: () => Promise<void>;
  createSpot: (data: {
    latitude: number;
    longitude: number;
    make: string;
    model: string;
    color?: string;
    year?: number;
    photos: string[];
    videoUrl?: string;
    description: string;
  }) => Promise<CarSpotting | null>;
}

export function useCarSpotting(options: UseCarSpottingOptions = {}): UseCarSpottingReturn {
  const { autoConnect = true, bounds, limit = 50 } = options;

  const [spots, setSpots] = useState<CarSpotting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Fetch initial spots from API
  const fetchSpots = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('limit', limit.toString());
      if (bounds) {
        params.set('bounds', `${bounds.west},${bounds.south},${bounds.east},${bounds.north}`);
      }

      const res = await fetch(`/api/car-spotting?${params}`);
      const data = await res.json();

      if (data.success) {
        setSpots(data.data);
      } else {
        setError(data.error || 'Failed to load spots');
      }
    } catch (err) {
      setError('Failed to load spots');
      console.error('Error fetching spots:', err);
    } finally {
      setLoading(false);
    }
  }, [bounds, limit]);

  // Connect to Socket.io for real-time updates
  useEffect(() => {
    if (!autoConnect) return;

    const socket = connectSocket();

    socket.on('connect', () => {
      setConnected(true);
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    // Subscribe to car spotting events
    unsubscribeRef.current = onCarSpotted((event: CarSpottingEvent) => {
      // Convert socket event to our CarSpotting format
      const newSpot: CarSpotting = {
        id: event.id,
        make: event.make,
        model: event.model,
        color: event.color,
        year: event.year,
        photos: event.photos,
        videoUrl: event.videoUrl,
        description: event.description,
        latitude: event.location.latitude,
        longitude: event.location.longitude,
        spottedAt: new Date(event.spottedAt).toISOString(),
        likeCount: 0,
        viewCount: 0,
        spotter: {
          id: event.spotterId,
          username: event.spotterUsername,
        },
      };

      // Add to top of list (avoid duplicates)
      setSpots((prev) => {
        if (prev.some((s) => s.id === newSpot.id)) {
          return prev;
        }
        return [newSpot, ...prev];
      });
    });

    return () => {
      unsubscribeRef.current?.();
    };
  }, [autoConnect]);

  // Initial fetch
  useEffect(() => {
    fetchSpots();
  }, [fetchSpots]);

  // Create a new spot
  const createSpot = useCallback(
    async (data: {
      latitude: number;
      longitude: number;
      make: string;
      model: string;
      color?: string;
      year?: number;
      photos: string[];
      videoUrl?: string;
      description: string;
    }): Promise<CarSpotting | null> => {
      try {
        const res = await fetch('/api/car-spotting', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });

        const result = await res.json();

        if (result.success) {
          // Broadcast via Socket.io for real-time update
          reportCarSpotting({
            id: result.data.id,
            latitude: data.latitude,
            longitude: data.longitude,
            make: data.make,
            model: data.model,
            color: data.color,
            year: data.year,
            photos: data.photos,
            videoUrl: data.videoUrl,
            description: data.description,
          });

          return result.data;
        } else {
          setError(result.error || 'Failed to create spot');
          return null;
        }
      } catch (err) {
        setError('Failed to create spot');
        console.error('Error creating spot:', err);
        return null;
      }
    },
    []
  );

  return {
    spots,
    loading,
    error,
    connected,
    refresh: fetchSpots,
    createSpot,
  };
}
