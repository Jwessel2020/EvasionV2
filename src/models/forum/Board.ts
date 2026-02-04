import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IBoard extends Document {
  // Basic info
  name: string;
  slug: string;
  description: string;
  icon?: string;
  color?: string;
  banner?: string;
  
  // Hierarchy
  parentBoard?: mongoose.Types.ObjectId;
  order: number;
  
  // Type
  type: 'category' | 'board' | 'user-created';
  
  // Ownership (for user-created boards)
  createdBy?: mongoose.Types.ObjectId;
  
  // Stats
  threadCount: number;
  postCount: number;
  followerCount: number;
  
  // Latest activity
  lastThreadId?: mongoose.Types.ObjectId;
  lastThreadTitle?: string;
  lastPostAt?: Date;
  lastPostBy?: mongoose.Types.ObjectId;
  
  // Settings
  settings: {
    isPrivate: boolean;
    requireApproval: boolean;
    allowPolls: boolean;
    allowImages: boolean;
    allowVideos: boolean;
    minRepToPost: number;
    minRepToCreate: number;
  };
  
  // Moderation
  moderators: mongoose.Types.ObjectId[];
  isArchived: boolean;
  isLocked: boolean;
  
  // SEO
  metaTitle?: string;
  metaDescription?: string;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

const BoardSchema = new Schema<IBoard>(
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
    description: { type: String, required: true, maxlength: 500 },
    icon: String,
    color: { type: String, default: '#6366f1' },
    banner: String,
    
    parentBoard: { type: Schema.Types.ObjectId, ref: 'Board', index: true },
    order: { type: Number, default: 0 },
    
    type: { 
      type: String, 
      enum: ['category', 'board', 'user-created'], 
      default: 'board' 
    },
    
    createdBy: { type: Schema.Types.ObjectId, ref: 'ForumUser' },
    
    threadCount: { type: Number, default: 0 },
    postCount: { type: Number, default: 0 },
    followerCount: { type: Number, default: 0 },
    
    lastThreadId: { type: Schema.Types.ObjectId, ref: 'Thread' },
    lastThreadTitle: String,
    lastPostAt: Date,
    lastPostBy: { type: Schema.Types.ObjectId, ref: 'ForumUser' },
    
    settings: {
      isPrivate: { type: Boolean, default: false },
      requireApproval: { type: Boolean, default: false },
      allowPolls: { type: Boolean, default: true },
      allowImages: { type: Boolean, default: true },
      allowVideos: { type: Boolean, default: true },
      minRepToPost: { type: Number, default: 0 },
      minRepToCreate: { type: Number, default: 0 },
    },
    
    moderators: [{ type: Schema.Types.ObjectId, ref: 'ForumUser' }],
    isArchived: { type: Boolean, default: false },
    isLocked: { type: Boolean, default: false },
    
    metaTitle: String,
    metaDescription: String,
  },
  { 
    timestamps: true,
  }
);

// Indexes
BoardSchema.index({ type: 1, order: 1 });
BoardSchema.index({ name: 'text', description: 'text' });
BoardSchema.index({ followerCount: -1 });
BoardSchema.index({ lastPostAt: -1 });

export const Board: Model<IBoard> = 
  mongoose.models.Board || mongoose.model<IBoard>('Board', BoardSchema);
