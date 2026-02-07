/**
 * Socket.io Server
 * Handles real-time location broadcasting and alerts
 * 
 * Run separately with: npx ts-node server/socket-server.ts
 * Or integrate with custom Next.js server
 */

import { Server } from 'socket.io';
import { createServer } from 'http';

const PORT = process.env.SOCKET_PORT || 3001;

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Store active users and their locations
interface UserLocation {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  location: { latitude: number; longitude: number };
  heading?: number;
  speed?: number;
  vehicleId?: string;
  vehicleName?: string;
  lastUpdated: number;
}

interface PoliceAlert {
  id: string;
  reporterId: string;
  location: { latitude: number; longitude: number };
  reportType: string;
  description?: string;
  confirmations: number;
  reportedAt: number;
  expiresAt: number;
}

interface CarSpotting {
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

const activeUsers = new Map<string, UserLocation>();
const policeAlerts = new Map<string, PoliceAlert>();
const userSockets = new Map<string, string>(); // socketId -> userId

// Clean up expired alerts every minute
setInterval(() => {
  const now = Date.now();
  policeAlerts.forEach((alert, id) => {
    if (alert.expiresAt < now) {
      policeAlerts.delete(id);
      io.emit('alert:expired', id);
    }
  });
}, 60000);

io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  // Authenticate user (simplified - in production, verify JWT)
  const userId = socket.handshake.auth?.userId || `anon-${socket.id}`;
  const username = socket.handshake.auth?.username || 'anonymous';
  const displayName = socket.handshake.auth?.displayName || 'Anonymous Driver';
  
  userSockets.set(socket.id, userId);

  // Send current active users to new connection
  socket.emit('friend:location', Array.from(activeUsers.values()));
  
  // Send active alerts
  socket.emit('alert:new', Array.from(policeAlerts.values()));

  // Handle location updates
  socket.on('location:update', (data) => {
    const userLocation: UserLocation = {
      id: socket.id,
      userId,
      username,
      displayName,
      avatarUrl: null,
      location: {
        latitude: data.latitude,
        longitude: data.longitude,
      },
      heading: data.heading,
      speed: data.speed,
      vehicleId: data.vehicleId,
      lastUpdated: Date.now(),
    };

    activeUsers.set(userId, userLocation);

    // Broadcast to all other users
    socket.broadcast.emit('friend:location', userLocation);
  });

  // Handle stop broadcasting
  socket.on('location:stop', () => {
    activeUsers.delete(userId);
    socket.broadcast.emit('friend:offline', userId);
  });

  // Handle area subscription (for future optimization)
  socket.on('subscribe:area', (bounds) => {
    // TODO: Implement geo-filtering to only send relevant updates
    console.log(`User ${userId} subscribed to area:`, bounds);
  });

  // Handle new alert reports
  socket.on('alert:report', (data) => {
    const alertId = `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const alert: PoliceAlert = {
      id: alertId,
      reporterId: userId,
      location: {
        latitude: data.latitude,
        longitude: data.longitude,
      },
      reportType: data.reportType,
      description: data.description,
      confirmations: 0,
      reportedAt: Date.now(),
      expiresAt: Date.now() + 30 * 60 * 1000, // 30 minutes
    };

    policeAlerts.set(alertId, alert);
    
    // Broadcast to all users
    io.emit('alert:new', alert);
  });

  // Handle alert confirmations
  socket.on('alert:confirm', (alertId) => {
    const alert = policeAlerts.get(alertId);
    if (alert) {
      alert.confirmations += 1;
      // Extend expiry on confirmation
      alert.expiresAt = Date.now() + 40 * 60 * 1000;
      policeAlerts.set(alertId, alert);

      io.emit('alert:confirmed', alert);
    }
  });

  // Handle car spotting reports
  socket.on('car:spotted', (data) => {
    const spotting: CarSpotting = {
      id: data.id || `spot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      spotterId: userId,
      spotterUsername: username,
      location: {
        latitude: data.latitude,
        longitude: data.longitude,
      },
      make: data.make,
      model: data.model,
      color: data.color,
      year: data.year,
      photos: data.photos || [],
      videoUrl: data.videoUrl,
      description: data.description,
      spottedAt: Date.now(),
    };

    // Broadcast to all users
    io.emit('car:spotted', spotting);
    console.log(`🚗 New car spotting: ${data.make} ${data.model} by ${username}`);
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
    
    const disconnectedUserId = userSockets.get(socket.id);
    if (disconnectedUserId) {
      activeUsers.delete(disconnectedUserId);
      socket.broadcast.emit('friend:offline', disconnectedUserId);
      userSockets.delete(socket.id);
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`🚀 Socket.io server running on port ${PORT}`);
});

export { io };
