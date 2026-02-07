/**
 * Socket.io Client Configuration
 * For real-time location broadcasting and alerts
 */

import { io, Socket } from 'socket.io-client';
import type { LiveUserPin, PoliceAlert, Coordinates } from '@/types';

// Car spotting type for real-time updates
interface CarSpottingEvent {
  id: string;
  spotterId: string;
  spotterUsername: string;
  location: { latitude: number; longitude: number };
  make: string;
  model: string;
  color?: string;
  year?: number;
  photos: string[];
  videoUrl?: string;
  description?: string;
  spottedAt: number;
}

// Socket event types
interface ServerToClientEvents {
  'friend:location': (data: LiveUserPin) => void;
  'friend:offline': (userId: string) => void;
  'alert:new': (alert: PoliceAlert) => void;
  'alert:confirmed': (alert: PoliceAlert) => void;
  'alert:expired': (alertId: string) => void;
  'car:spotted': (spotting: CarSpottingEvent) => void;
  'error': (message: string) => void;
}

interface ClientToServerEvents {
  'location:update': (data: {
    latitude: number;
    longitude: number;
    heading?: number;
    speed?: number;
    vehicleId?: string;
  }) => void;
  'location:stop': () => void;
  'subscribe:area': (bounds: { north: number; south: number; east: number; west: number }) => void;
  'alert:report': (data: {
    latitude: number;
    longitude: number;
    reportType: string;
    description?: string;
  }) => void;
  'alert:confirm': (alertId: string) => void;
  'car:spotted': (data: {
    id?: string;
    latitude: number;
    longitude: number;
    make: string;
    model: string;
    color?: string;
    year?: number;
    photos: string[];
    videoUrl?: string;
    description?: string;
  }) => void;
}

type EvasionSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: EvasionSocket | null = null;

/**
 * Get or create socket connection
 */
export function getSocket(): EvasionSocket {
  if (!socket) {
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';
    
    socket = io(socketUrl, {
      autoConnect: false,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      console.log('🔌 Socket connected:', socket?.id);
    });

    socket.on('disconnect', (reason) => {
      console.log('🔌 Socket disconnected:', reason);
    });

    socket.on('error', (message) => {
      console.error('🔌 Socket error:', message);
    });
  }

  return socket;
}

/**
 * Connect to socket server
 */
export function connectSocket(authToken?: string): EvasionSocket {
  const s = getSocket();
  
  if (authToken) {
    s.auth = { token: authToken };
  }
  
  if (!s.connected) {
    s.connect();
  }
  
  return s;
}

/**
 * Disconnect from socket server
 */
export function disconnectSocket(): void {
  if (socket?.connected) {
    socket.disconnect();
  }
}

/**
 * Broadcast location update
 */
export function broadcastLocation(
  location: Coordinates,
  heading?: number,
  speed?: number,
  vehicleId?: string
): void {
  const s = getSocket();
  if (s.connected) {
    s.emit('location:update', {
      latitude: location.latitude,
      longitude: location.longitude,
      heading,
      speed,
      vehicleId,
    });
  }
}

/**
 * Stop broadcasting location
 */
export function stopBroadcasting(): void {
  const s = getSocket();
  if (s.connected) {
    s.emit('location:stop');
  }
}

/**
 * Subscribe to area updates
 */
export function subscribeToArea(bounds: {
  north: number;
  south: number;
  east: number;
  west: number;
}): void {
  const s = getSocket();
  if (s.connected) {
    s.emit('subscribe:area', bounds);
  }
}

/**
 * Report police alert
 */
export function reportAlert(
  location: Coordinates,
  reportType: string,
  description?: string
): void {
  const s = getSocket();
  if (s.connected) {
    s.emit('alert:report', {
      latitude: location.latitude,
      longitude: location.longitude,
      reportType,
      description,
    });
  }
}

/**
 * Confirm an alert
 */
export function confirmAlert(alertId: string): void {
  const s = getSocket();
  if (s.connected) {
    s.emit('alert:confirm', alertId);
  }
}

/**
 * Report a car spotting (broadcasts in real-time to all users)
 */
export function reportCarSpotting(data: {
  id?: string;
  latitude: number;
  longitude: number;
  make: string;
  model: string;
  color?: string;
  year?: number;
  photos: string[];
  videoUrl?: string;
  description?: string;
}): void {
  const s = getSocket();
  if (s.connected) {
    s.emit('car:spotted', data);
  }
}

/**
 * Subscribe to car spotting events
 */
export function onCarSpotted(
  callback: (spotting: CarSpottingEvent) => void
): () => void {
  const s = getSocket();
  s.on('car:spotted', callback);
  return () => s.off('car:spotted', callback);
}

export type { CarSpottingEvent };
