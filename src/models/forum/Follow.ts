import mongoose, { Schema, Document, Model } from 'mongoose';

export type FollowTarget = 'user' | 'board' | 'group' | 'thread' | 'shop';

export interface IFollow extends Document {
  // Who is following
  follower: mongoose.Types.ObjectId;
  
  // What type they're following
  targetType: FollowTarget;
  
  // The target (one of these based on targetType)
  targetUser?: mongoose.Types.ObjectId;
  targetBoard?: mongoose.Types.ObjectId;
  targetGroup?: mongoose.Types.ObjectId;
  targetThread?: mongoose.Types.ObjectId;
  targetShop?: mongoose.Types.ObjectId;
  
  // Notification preferences for this follow
  notifications: {
    newThreads: boolean;
    newComments: boolean;
    mentions: boolean;
  };
  
  // Timestamp
  createdAt: Date;
}

const FollowSchema = new Schema<IFollow>(
  {
    follower: { type: Schema.Types.ObjectId, ref: 'ForumUser', required: true },
    
    targetType: {
      type: String,
      enum: ['user', 'board', 'group', 'thread', 'shop'],
      required: true
    },

    targetUser: { type: Schema.Types.ObjectId, ref: 'ForumUser' },
    targetBoard: { type: Schema.Types.ObjectId, ref: 'Board' },
    targetGroup: { type: Schema.Types.ObjectId, ref: 'Group' },
    targetThread: { type: Schema.Types.ObjectId, ref: 'Thread' },
    targetShop: { type: Schema.Types.ObjectId, ref: 'Shop' },
    
    notifications: {
      newThreads: { type: Boolean, default: true },
      newComments: { type: Boolean, default: true },
      mentions: { type: Boolean, default: true },
    },
  },
  { 
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Unique follow per user per target
FollowSchema.index({ follower: 1, targetType: 1, targetUser: 1 }, { unique: true, sparse: true });
FollowSchema.index({ follower: 1, targetType: 1, targetBoard: 1 }, { unique: true, sparse: true });
FollowSchema.index({ follower: 1, targetType: 1, targetGroup: 1 }, { unique: true, sparse: true });
FollowSchema.index({ follower: 1, targetType: 1, targetThread: 1 }, { unique: true, sparse: true });
FollowSchema.index({ follower: 1, targetType: 1, targetShop: 1 }, { unique: true, sparse: true });

// For getting followers of a target
FollowSchema.index({ targetUser: 1, createdAt: -1 });
FollowSchema.index({ targetBoard: 1, createdAt: -1 });
FollowSchema.index({ targetGroup: 1, createdAt: -1 });
FollowSchema.index({ targetThread: 1, createdAt: -1 });
FollowSchema.index({ targetShop: 1, createdAt: -1 });

// For getting what a user follows
FollowSchema.index({ follower: 1, targetType: 1, createdAt: -1 });

export const Follow: Model<IFollow> = 
  mongoose.models.Follow || mongoose.model<IFollow>('Follow', FollowSchema);
