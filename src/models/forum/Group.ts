import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IGroupMember {
  userId: mongoose.Types.ObjectId;
  role: 'member' | 'moderator' | 'admin' | 'owner';
  joinedAt: Date;
  invitedBy?: mongoose.Types.ObjectId;
}

export interface IGroup extends Document {
  // Basic info
  name: string;
  slug: string;
  description: string;
  shortDescription?: string;
  avatar?: string;
  banner?: string;
  
  // Type & Privacy
  type: 'public' | 'private' | 'secret';
  category: 'car-club' | 'brand' | 'regional' | 'racing' | 'diy' | 'marketplace' | 'events' | 'other';
  
  // Tags for discovery
  tags: string[];
  
  // Location (for regional groups)
  location?: {
    city?: string;
    state?: string;
    country?: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
  };
  
  // Ownership
  createdBy: mongoose.Types.ObjectId;
  
  // Members (embedded for small groups, referenced for large)
  memberCount: number;
  members: IGroupMember[];
  
  // Pending requests (for private groups)
  pendingRequests: {
    userId: mongoose.Types.ObjectId;
    requestedAt: Date;
    message?: string;
  }[];
  
  // Stats
  threadCount: number;
  postCount: number;
  
  // Latest activity
  lastActivityAt: Date;
  lastThreadId?: mongoose.Types.ObjectId;
  
  // Settings
  settings: {
    allowMemberInvites: boolean;
    allowMemberPosts: boolean;
    requirePostApproval: boolean;
    showMemberList: boolean;
    allowEvents: boolean;
    welcomeMessage?: string;
  };
  
  // Rules
  rules: {
    title: string;
    description: string;
  }[];
  
  // Moderation
  isVerified: boolean;
  isFeatured: boolean;
  isArchived: boolean;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

const GroupMemberSchema = new Schema<IGroupMember>({
  userId: { type: Schema.Types.ObjectId, ref: 'ForumUser', required: true },
  role: { 
    type: String, 
    enum: ['member', 'moderator', 'admin', 'owner'], 
    default: 'member' 
  },
  joinedAt: { type: Date, default: Date.now },
  invitedBy: { type: Schema.Types.ObjectId, ref: 'ForumUser' },
}, { _id: false });

const GroupSchema = new Schema<IGroup>(
  {
    name: { type: String, required: true, maxlength: 100 },
    slug: { 
      type: String, 
      required: true, 
      unique: true, 
      lowercase: true,
      trim: true,
      match: /^[a-z0-9-]+$/,
    },
    description: { type: String, required: true, maxlength: 2000 },
    shortDescription: { type: String, maxlength: 200 },
    avatar: String,
    banner: String,
    
    type: { 
      type: String, 
      enum: ['public', 'private', 'secret'], 
      default: 'public' 
    },
    category: { 
      type: String, 
      enum: ['car-club', 'brand', 'regional', 'racing', 'diy', 'marketplace', 'events', 'other'],
      default: 'other'
    },
    
    tags: [{ type: String, lowercase: true }],
    
    location: {
      city: String,
      state: String,
      country: String,
      coordinates: {
        lat: Number,
        lng: Number,
      },
    },
    
    createdBy: { type: Schema.Types.ObjectId, ref: 'ForumUser', required: true },
    
    memberCount: { type: Number, default: 1 },
    members: [GroupMemberSchema],
    
    pendingRequests: [{
      userId: { type: Schema.Types.ObjectId, ref: 'ForumUser' },
      requestedAt: { type: Date, default: Date.now },
      message: String,
    }],
    
    threadCount: { type: Number, default: 0 },
    postCount: { type: Number, default: 0 },
    
    lastActivityAt: { type: Date, default: Date.now },
    lastThreadId: { type: Schema.Types.ObjectId, ref: 'Thread' },
    
    settings: {
      allowMemberInvites: { type: Boolean, default: true },
      allowMemberPosts: { type: Boolean, default: true },
      requirePostApproval: { type: Boolean, default: false },
      showMemberList: { type: Boolean, default: true },
      allowEvents: { type: Boolean, default: true },
      welcomeMessage: String,
    },
    
    rules: [{
      title: { type: String, required: true },
      description: { type: String, required: true },
    }],
    
    isVerified: { type: Boolean, default: false },
    isFeatured: { type: Boolean, default: false },
    isArchived: { type: Boolean, default: false },
  },
  { 
    timestamps: true,
  }
);

// Indexes
GroupSchema.index({ name: 'text', description: 'text', tags: 'text' });
GroupSchema.index({ type: 1, category: 1 });
GroupSchema.index({ memberCount: -1 });
GroupSchema.index({ lastActivityAt: -1 });
GroupSchema.index({ 'location.country': 1, 'location.state': 1 });
GroupSchema.index({ tags: 1 });
GroupSchema.index({ isFeatured: 1, memberCount: -1 });
GroupSchema.index({ 'members.userId': 1 });

export const Group: Model<IGroup> = 
  mongoose.models.Group || mongoose.model<IGroup>('Group', GroupSchema);
