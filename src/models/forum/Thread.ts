import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IPollOption {
  _id: mongoose.Types.ObjectId;
  text: string;
  votes: number;
  voters: mongoose.Types.ObjectId[];
}

export interface IPoll {
  question: string;
  options: IPollOption[];
  allowMultiple: boolean;
  endsAt?: Date;
  totalVotes: number;
}

export interface IThread extends Document {
  // Basic info
  title: string;
  slug: string;
  content: string;
  contentHtml?: string; // Pre-rendered HTML for performance
  excerpt?: string;
  
  // Author
  author: mongoose.Types.ObjectId;
  authorUsername: string; // Denormalized for performance
  authorAvatar?: string;
  
  // Location (board or group)
  board?: mongoose.Types.ObjectId;
  group?: mongoose.Types.ObjectId;
  
  // Type & Status
  type: 'discussion' | 'question' | 'showcase' | 'build-log' | 'for-sale' | 'event' | 'poll';
  status: 'open' | 'closed' | 'resolved' | 'sold';
  
  // Tags
  tags: string[];
  
  // Media
  images: {
    url: string;
    thumbnail?: string;
    caption?: string;
    order: number;
  }[];
  videos: {
    url: string;
    provider: 'youtube' | 'vimeo' | 'direct';
    thumbnail?: string;
  }[];
  
  // Poll (if type is poll)
  poll?: IPoll;
  
  // Vehicle reference (for build logs, showcase)
  vehicle?: {
    year: number;
    make: string;
    model: string;
    trim?: string;
  };
  
  // For sale specific
  forSale?: {
    price: number;
    currency: string;
    condition: 'new' | 'like-new' | 'good' | 'fair' | 'parts';
    shipsTo?: string[];
    location?: string;
  };
  
  // Event specific
  event?: {
    startDate: Date;
    endDate?: Date;
    location: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
    rsvpCount: number;
    maxAttendees?: number;
  };
  
  // Engagement stats
  viewCount: number;
  replyCount: number;
  likeCount: number;
  bookmarkCount: number;
  shareCount: number;
  
  // Hot/trending score (calculated periodically)
  hotScore: number;
  
  // Last reply info (denormalized)
  lastReplyAt?: Date;
  lastReplyBy?: mongoose.Types.ObjectId;
  lastReplyUsername?: string;
  
  // Moderation
  isPinned: boolean;
  isLocked: boolean;
  isHidden: boolean;
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: mongoose.Types.ObjectId;
  
  // Edit history
  editedAt?: Date;
  editCount: number;
  
  // SEO
  metaTitle?: string;
  metaDescription?: string;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

const PollOptionSchema = new Schema<IPollOption>({
  text: { type: String, required: true, maxlength: 200 },
  votes: { type: Number, default: 0 },
  voters: [{ type: Schema.Types.ObjectId, ref: 'ForumUser' }],
});

const ThreadSchema = new Schema<IThread>(
  {
    title: { type: String, required: true, maxlength: 200 },
    slug: { type: String, required: true, lowercase: true, trim: true },
    content: { type: String, required: true, maxlength: 50000 },
    contentHtml: String,
    excerpt: { type: String, maxlength: 500 },
    
    author: { type: Schema.Types.ObjectId, ref: 'ForumUser', required: true, index: true },
    authorUsername: { type: String, required: true },
    authorAvatar: String,
    
    board: { type: Schema.Types.ObjectId, ref: 'Board', index: true },
    group: { type: Schema.Types.ObjectId, ref: 'Group', index: true },
    
    type: { 
      type: String, 
      enum: ['discussion', 'question', 'showcase', 'build-log', 'for-sale', 'event', 'poll'],
      default: 'discussion'
    },
    status: { 
      type: String, 
      enum: ['open', 'closed', 'resolved', 'sold'],
      default: 'open'
    },
    
    tags: [{ type: String, lowercase: true, index: true }],
    
    images: [{
      url: { type: String, required: true },
      thumbnail: String,
      caption: String,
      order: { type: Number, default: 0 },
    }],
    videos: [{
      url: { type: String, required: true },
      provider: { type: String, enum: ['youtube', 'vimeo', 'direct'], default: 'youtube' },
      thumbnail: String,
    }],
    
    poll: {
      question: String,
      options: [PollOptionSchema],
      allowMultiple: { type: Boolean, default: false },
      endsAt: Date,
      totalVotes: { type: Number, default: 0 },
    },
    
    vehicle: {
      year: Number,
      make: String,
      model: String,
      trim: String,
    },
    
    forSale: {
      price: Number,
      currency: { type: String, default: 'USD' },
      condition: { type: String, enum: ['new', 'like-new', 'good', 'fair', 'parts'] },
      shipsTo: [String],
      location: String,
    },
    
    event: {
      startDate: Date,
      endDate: Date,
      location: String,
      coordinates: {
        lat: Number,
        lng: Number,
      },
      rsvpCount: { type: Number, default: 0 },
      maxAttendees: Number,
    },
    
    viewCount: { type: Number, default: 0 },
    replyCount: { type: Number, default: 0 },
    likeCount: { type: Number, default: 0 },
    bookmarkCount: { type: Number, default: 0 },
    shareCount: { type: Number, default: 0 },
    
    hotScore: { type: Number, default: 0, index: true },
    
    lastReplyAt: { type: Date, index: true },
    lastReplyBy: { type: Schema.Types.ObjectId, ref: 'ForumUser' },
    lastReplyUsername: String,
    
    isPinned: { type: Boolean, default: false },
    isLocked: { type: Boolean, default: false },
    isHidden: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    deletedAt: Date,
    deletedBy: { type: Schema.Types.ObjectId, ref: 'ForumUser' },
    
    editedAt: Date,
    editCount: { type: Number, default: 0 },
    
    metaTitle: String,
    metaDescription: String,
  },
  { 
    timestamps: true,
  }
);

// Compound indexes for common queries
ThreadSchema.index({ board: 1, isPinned: -1, lastReplyAt: -1 });
ThreadSchema.index({ group: 1, isPinned: -1, lastReplyAt: -1 });
ThreadSchema.index({ board: 1, createdAt: -1 });
ThreadSchema.index({ author: 1, createdAt: -1 });
ThreadSchema.index({ type: 1, createdAt: -1 });
ThreadSchema.index({ hotScore: -1, createdAt: -1 });

// Text search index
ThreadSchema.index({ title: 'text', content: 'text', tags: 'text' });

// Unique slug per board/group
ThreadSchema.index({ board: 1, slug: 1 }, { unique: true, sparse: true });
ThreadSchema.index({ group: 1, slug: 1 }, { unique: true, sparse: true });

export const Thread: Model<IThread> = 
  mongoose.models.Thread || mongoose.model<IThread>('Thread', ThreadSchema);
