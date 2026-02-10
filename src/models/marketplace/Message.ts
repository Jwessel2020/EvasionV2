import mongoose, { Schema, Document, Model } from 'mongoose';

export type ConversationStatus = 'active' | 'archived' | 'blocked';
export type OfferStatus = 'pending' | 'accepted' | 'rejected' | 'expired' | 'countered' | 'withdrawn';

export interface IMessageAttachment {
  type: 'image' | 'file';
  url: string;
  name?: string;
  size?: number;
}

export interface IMessageOffer {
  amount: number;
  currency: string;
  status: OfferStatus;
  expiresAt: Date;
  respondedAt?: Date;
  counterAmount?: number;
  note?: string;
}

// Conversation model - represents a thread between two users
export interface IConversation extends Document {
  // Participants (always 2 for now)
  participants: mongoose.Types.ObjectId[];
  participantUsernames: string[];
  participantAvatars: (string | null)[];

  // Context (what the conversation is about)
  listing?: mongoose.Types.ObjectId;
  listingTitle?: string;
  listingImage?: string;
  listingPrice?: number;
  order?: mongoose.Types.ObjectId;

  // Last message preview
  lastMessage?: {
    content: string;
    senderId: mongoose.Types.ObjectId;
    senderUsername: string;
    sentAt: Date;
    isOffer: boolean;
  };

  // Unread counts per participant
  unreadCount: Map<string, number>;

  // Status
  status: ConversationStatus;
  blockedBy?: mongoose.Types.ObjectId;

  // Message count
  messageCount: number;

  // Active offer (if any)
  activeOffer?: {
    messageId: mongoose.Types.ObjectId;
    amount: number;
    status: OfferStatus;
    expiresAt: Date;
  };

  createdAt: Date;
  updatedAt: Date;
}

const ConversationSchema = new Schema<IConversation>(
  {
    participants: [{
      type: Schema.Types.ObjectId,
      ref: 'ForumUser',
      required: true,
    }],
    participantUsernames: [{ type: String, required: true }],
    participantAvatars: [{ type: String }],

    listing: { type: Schema.Types.ObjectId, ref: 'Listing', index: true },
    listingTitle: String,
    listingImage: String,
    listingPrice: Number,
    order: { type: Schema.Types.ObjectId, ref: 'Order' },

    lastMessage: {
      content: String,
      senderId: { type: Schema.Types.ObjectId, ref: 'ForumUser' },
      senderUsername: String,
      sentAt: Date,
      isOffer: { type: Boolean, default: false },
    },

    unreadCount: {
      type: Map,
      of: Number,
      default: new Map(),
    },

    status: {
      type: String,
      enum: ['active', 'archived', 'blocked'],
      default: 'active',
    },
    blockedBy: { type: Schema.Types.ObjectId, ref: 'ForumUser' },

    messageCount: { type: Number, default: 0 },

    activeOffer: {
      messageId: { type: Schema.Types.ObjectId },
      amount: Number,
      status: String,
      expiresAt: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for finding conversations between two users
ConversationSchema.index({ participants: 1 });
ConversationSchema.index({ participants: 1, listing: 1 }, { unique: true, sparse: true });
ConversationSchema.index({ updatedAt: -1 });
ConversationSchema.index({ 'participants': 1, 'status': 1, 'updatedAt': -1 });

// Helper to get the other participant
ConversationSchema.methods.getOtherParticipant = function(userId: string) {
  const index = this.participants.findIndex(
    (p: mongoose.Types.ObjectId) => p.toString() !== userId
  );
  return {
    id: this.participants[index],
    username: this.participantUsernames[index],
    avatar: this.participantAvatars[index],
  };
};

export const Conversation: Model<IConversation> =
  mongoose.models.Conversation || mongoose.model<IConversation>('Conversation', ConversationSchema);


// Message model - individual messages in a conversation
export interface IMessage extends Document {
  conversation: mongoose.Types.ObjectId;
  sender: mongoose.Types.ObjectId;
  senderUsername: string;
  senderAvatar?: string;

  // Content
  content: string;
  attachments: IMessageAttachment[];

  // Offer (if this message is a price offer)
  offer?: IMessageOffer;

  // Read status
  isRead: boolean;
  readAt?: Date;

  // System message (for status updates)
  isSystemMessage: boolean;
  systemMessageType?: 'offer_accepted' | 'offer_rejected' | 'offer_expired' | 'order_created' | 'order_status';

  // Moderation
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: mongoose.Types.ObjectId;

  // Reply reference
  replyTo?: mongoose.Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

const MessageAttachmentSchema = new Schema({
  type: { type: String, enum: ['image', 'file'], required: true },
  url: { type: String, required: true },
  name: String,
  size: Number,
}, { _id: false });

const MessageOfferSchema = new Schema({
  amount: { type: Number, required: true, min: 0 },
  currency: { type: String, default: 'USD' },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'expired', 'countered', 'withdrawn'],
    default: 'pending',
  },
  expiresAt: { type: Date, required: true },
  respondedAt: Date,
  counterAmount: Number,
  note: String,
}, { _id: false });

const MessageSchema = new Schema<IMessage>(
  {
    conversation: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    sender: { type: Schema.Types.ObjectId, ref: 'ForumUser', required: true },
    senderUsername: { type: String, required: true },
    senderAvatar: String,

    content: { type: String, maxlength: 2000 },
    attachments: [MessageAttachmentSchema],

    offer: MessageOfferSchema,

    isRead: { type: Boolean, default: false },
    readAt: Date,

    isSystemMessage: { type: Boolean, default: false },
    systemMessageType: {
      type: String,
      enum: ['offer_accepted', 'offer_rejected', 'offer_expired', 'order_created', 'order_status'],
    },

    isDeleted: { type: Boolean, default: false },
    deletedAt: Date,
    deletedBy: { type: Schema.Types.ObjectId, ref: 'ForumUser' },

    replyTo: { type: Schema.Types.ObjectId, ref: 'Message' },
  },
  {
    timestamps: true,
  }
);

// Indexes
MessageSchema.index({ conversation: 1, createdAt: -1 });
MessageSchema.index({ conversation: 1, isRead: 1 });
MessageSchema.index({ sender: 1, createdAt: -1 });
MessageSchema.index({ 'offer.status': 1, 'offer.expiresAt': 1 }); // For expiring offers

export const Message: Model<IMessage> =
  mongoose.models.Message || mongoose.model<IMessage>('Message', MessageSchema);
