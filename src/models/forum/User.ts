import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IVehicle {
  _id: mongoose.Types.ObjectId;
  year: number;
  make: string;
  model: string;
  trim?: string;
  nickname?: string;
  photos: string[];
  mods?: string[];
  isPrimary: boolean;
  createdAt: Date;
}

export interface IForumUser extends Document {
  // Link to auth system (Supabase user ID)
  authId: string;
  
  // Profile info
  username: string;
  displayName: string;
  avatar?: string;
  banner?: string;
  bio?: string;
  location?: string;
  website?: string;
  
  // Garage - user's vehicles
  garage: IVehicle[];
  
  // Stats
  reputation: number;
  postCount: number;
  threadCount: number;
  
  // Social
  followerCount: number;
  followingCount: number;
  
  // Preferences
  preferences: {
    emailNotifications: boolean;
    pushNotifications: boolean;
    privateProfile: boolean;
    showGarage: boolean;
  };
  
  // Moderation
  role: 'member' | 'moderator' | 'admin';
  isBanned: boolean;
  banReason?: string;
  banExpiresAt?: Date;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  lastActiveAt: Date;
}

const VehicleSchema = new Schema<IVehicle>({
  year: { type: Number, required: true },
  make: { type: String, required: true },
  model: { type: String, required: true },
  trim: String,
  nickname: String,
  photos: [{ type: String }],
  mods: [{ type: String }],
  isPrimary: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

const ForumUserSchema = new Schema<IForumUser>(
  {
    authId: { type: String, required: true, unique: true, index: true },
    
    username: { 
      type: String, 
      required: true, 
      unique: true, 
      lowercase: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
      match: /^[a-z0-9_]+$/,
    },
    displayName: { type: String, required: true, maxlength: 50 },
    avatar: String,
    banner: String,
    bio: { type: String, maxlength: 500 },
    location: { type: String, maxlength: 100 },
    website: { type: String, maxlength: 200 },
    
    garage: [VehicleSchema],
    
    reputation: { type: Number, default: 0, index: true },
    postCount: { type: Number, default: 0 },
    threadCount: { type: Number, default: 0 },
    
    followerCount: { type: Number, default: 0 },
    followingCount: { type: Number, default: 0 },
    
    preferences: {
      emailNotifications: { type: Boolean, default: true },
      pushNotifications: { type: Boolean, default: true },
      privateProfile: { type: Boolean, default: false },
      showGarage: { type: Boolean, default: true },
    },
    
    role: { 
      type: String, 
      enum: ['member', 'moderator', 'admin'], 
      default: 'member' 
    },
    isBanned: { type: Boolean, default: false },
    banReason: String,
    banExpiresAt: Date,
    
    lastActiveAt: { type: Date, default: Date.now },
  },
  { 
    timestamps: true,
  }
);

// Indexes for common queries
ForumUserSchema.index({ username: 'text', displayName: 'text' });
ForumUserSchema.index({ createdAt: -1 });
ForumUserSchema.index({ reputation: -1 });

export const ForumUser: Model<IForumUser> = 
  mongoose.models.ForumUser || mongoose.model<IForumUser>('ForumUser', ForumUserSchema);
