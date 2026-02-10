import mongoose, { Schema, Document, Model } from 'mongoose';

export type NotificationType =
  // Forum notifications
  | 'new_follower'
  | 'thread_reply'
  | 'comment_reply'
  | 'mention'
  | 'reaction'
  | 'accepted_answer'
  | 'thread_in_followed_board'
  | 'thread_in_followed_group'
  | 'group_invite'
  | 'group_request_approved'
  | 'group_request_rejected'
  | 'mod_warning'
  | 'badge_earned'
  // Marketplace notifications
  | 'new_message'
  | 'offer_received'
  | 'offer_accepted'
  | 'offer_rejected'
  | 'offer_countered'
  | 'offer_response'
  | 'listing_sold'
  | 'price_drop'
  | 'order_status'
  | 'review_received'
  | 'review_response';

export interface INotification extends Document {
  // Recipient
  recipient: mongoose.Types.ObjectId;
  
  // Type
  type: NotificationType;
  
  // Actor (who triggered this notification)
  actor?: mongoose.Types.ObjectId;
  actorUsername?: string;
  actorAvatar?: string;
  
  // Related entities
  thread?: mongoose.Types.ObjectId;
  threadTitle?: string;
  comment?: mongoose.Types.ObjectId;
  board?: mongoose.Types.ObjectId;
  boardName?: string;
  group?: mongoose.Types.ObjectId;
  groupName?: string;
  
  // Additional data
  data?: Record<string, unknown>;
  
  // Message preview
  message: string;
  
  // Read status
  isRead: boolean;
  readAt?: Date;
  
  // Timestamp
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    recipient: { type: Schema.Types.ObjectId, ref: 'ForumUser', required: true, index: true },
    
    type: {
      type: String,
      enum: [
        // Forum notifications
        'new_follower',
        'thread_reply',
        'comment_reply',
        'mention',
        'reaction',
        'accepted_answer',
        'thread_in_followed_board',
        'thread_in_followed_group',
        'group_invite',
        'group_request_approved',
        'group_request_rejected',
        'mod_warning',
        'badge_earned',
        // Marketplace notifications
        'new_message',
        'offer_received',
        'offer_accepted',
        'offer_rejected',
        'offer_countered',
        'offer_response',
        'listing_sold',
        'price_drop',
        'order_status',
        'review_received',
        'review_response',
      ],
      required: true
    },
    
    actor: { type: Schema.Types.ObjectId, ref: 'ForumUser' },
    actorUsername: String,
    actorAvatar: String,
    
    thread: { type: Schema.Types.ObjectId, ref: 'Thread' },
    threadTitle: String,
    comment: { type: Schema.Types.ObjectId, ref: 'Comment' },
    board: { type: Schema.Types.ObjectId, ref: 'Board' },
    boardName: String,
    group: { type: Schema.Types.ObjectId, ref: 'Group' },
    groupName: String,
    
    data: { type: Schema.Types.Mixed },
    
    message: { type: String, required: true, maxlength: 500 },
    
    isRead: { type: Boolean, default: false },
    readAt: Date,
  },
  { 
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Indexes for efficient queries
NotificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
NotificationSchema.index({ recipient: 1, createdAt: -1 });

// TTL index - auto-delete notifications after 90 days
NotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export const Notification: Model<INotification> = 
  mongoose.models.Notification || mongoose.model<INotification>('Notification', NotificationSchema);
