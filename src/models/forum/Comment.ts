import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IComment extends Document {
  // Parent reference
  thread: mongoose.Types.ObjectId;
  
  // For nested replies
  parentComment?: mongoose.Types.ObjectId;
  depth: number; // 0 = top-level, 1 = reply to comment, etc.
  
  // Author
  author: mongoose.Types.ObjectId;
  authorUsername: string;
  authorAvatar?: string;
  
  // Content
  content: string;
  contentHtml?: string;
  
  // Media
  images: {
    url: string;
    thumbnail?: string;
  }[];
  
  // Mentions (@username)
  mentions: mongoose.Types.ObjectId[];
  
  // Quotes (replying to specific text)
  quotedComment?: mongoose.Types.ObjectId;
  quotedText?: string;
  
  // Engagement
  likeCount: number;
  replyCount: number;
  
  // Best answer (for question threads)
  isAcceptedAnswer: boolean;
  
  // Moderation
  isHidden: boolean;
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: mongoose.Types.ObjectId;
  
  // Edit tracking
  editedAt?: Date;
  editCount: number;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

const CommentSchema = new Schema<IComment>(
  {
    thread: { type: Schema.Types.ObjectId, ref: 'Thread', required: true, index: true },
    
    parentComment: { type: Schema.Types.ObjectId, ref: 'Comment', index: true },
    depth: { type: Number, default: 0, max: 5 }, // Limit nesting depth
    
    author: { type: Schema.Types.ObjectId, ref: 'ForumUser', required: true, index: true },
    authorUsername: { type: String, required: true },
    authorAvatar: String,
    
    content: { type: String, required: true, maxlength: 10000 },
    contentHtml: String,
    
    images: [{
      url: { type: String, required: true },
      thumbnail: String,
    }],
    
    mentions: [{ type: Schema.Types.ObjectId, ref: 'ForumUser' }],
    
    quotedComment: { type: Schema.Types.ObjectId, ref: 'Comment' },
    quotedText: { type: String, maxlength: 500 },
    
    likeCount: { type: Number, default: 0 },
    replyCount: { type: Number, default: 0 },
    
    isAcceptedAnswer: { type: Boolean, default: false },
    
    isHidden: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    deletedAt: Date,
    deletedBy: { type: Schema.Types.ObjectId, ref: 'ForumUser' },
    
    editedAt: Date,
    editCount: { type: Number, default: 0 },
  },
  { 
    timestamps: true,
  }
);

// Indexes for efficient queries
CommentSchema.index({ thread: 1, createdAt: 1 });
CommentSchema.index({ thread: 1, parentComment: 1, createdAt: 1 });
CommentSchema.index({ author: 1, createdAt: -1 });
CommentSchema.index({ thread: 1, isAcceptedAnswer: 1 });
CommentSchema.index({ content: 'text' });

export const Comment: Model<IComment> = 
  mongoose.models.Comment || mongoose.model<IComment>('Comment', CommentSchema);
