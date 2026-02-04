import mongoose, { Schema, Document, Model } from 'mongoose';

export type ReactionType = 'like' | 'love' | 'laugh' | 'wow' | 'sad' | 'angry' | 'helpful' | 'agree' | 'disagree';

export interface IReaction extends Document {
  // Who reacted
  user: mongoose.Types.ObjectId;
  
  // What they reacted to (one of these)
  thread?: mongoose.Types.ObjectId;
  comment?: mongoose.Types.ObjectId;
  
  // Reaction type
  type: ReactionType;
  
  // Timestamp
  createdAt: Date;
}

const ReactionSchema = new Schema<IReaction>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'ForumUser', required: true },
    
    thread: { type: Schema.Types.ObjectId, ref: 'Thread' },
    comment: { type: Schema.Types.ObjectId, ref: 'Comment' },
    
    type: { 
      type: String, 
      enum: ['like', 'love', 'laugh', 'wow', 'sad', 'angry', 'helpful', 'agree', 'disagree'],
      default: 'like'
    },
  },
  { 
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Ensure unique reaction per user per content
ReactionSchema.index({ user: 1, thread: 1 }, { unique: true, sparse: true });
ReactionSchema.index({ user: 1, comment: 1 }, { unique: true, sparse: true });

// For counting reactions
ReactionSchema.index({ thread: 1, type: 1 });
ReactionSchema.index({ comment: 1, type: 1 });

export const Reaction: Model<IReaction> = 
  mongoose.models.Reaction || mongoose.model<IReaction>('Reaction', ReactionSchema);
