import mongoose, { Schema, Document, Model } from 'mongoose';

export type ReviewTargetType = 'seller' | 'shop' | 'buyer';

export interface IReviewRatings {
  itemAsDescribed: number;
  communication: number;
  shippingSpeed: number;
  overall: number;
}

export interface IReview extends Document {
  // Reviewer
  reviewer: mongoose.Types.ObjectId;
  reviewerUsername: string;
  reviewerAvatar?: string;

  // Target (who is being reviewed)
  targetType: ReviewTargetType;
  targetUser?: mongoose.Types.ObjectId;
  targetUsername?: string;
  targetShop?: mongoose.Types.ObjectId;
  targetShopName?: string;

  // Order/Listing reference
  order?: mongoose.Types.ObjectId;
  listing?: mongoose.Types.ObjectId;
  listingTitle?: string;

  // Rating (1-5 stars)
  rating: number;
  ratings?: IReviewRatings;

  // Content
  title?: string;
  content: string;
  pros?: string[];
  cons?: string[];
  photos?: string[];

  // Response from seller/shop
  response?: {
    content: string;
    respondedAt: Date;
    respondedBy: mongoose.Types.ObjectId;
  };

  // Verification
  isVerifiedPurchase: boolean;

  // Moderation
  isApproved: boolean;
  isHidden: boolean;
  hiddenReason?: string;
  reportCount: number;
  reports: Array<{
    userId: mongoose.Types.ObjectId;
    reason: string;
    reportedAt: Date;
  }>;

  // Helpful votes
  helpfulCount: number;
  notHelpfulCount: number;
  helpfulVotes: mongoose.Types.ObjectId[];
  notHelpfulVotes: mongoose.Types.ObjectId[];

  // Edit tracking
  isEdited: boolean;
  editedAt?: Date;
  originalContent?: string;

  createdAt: Date;
  updatedAt: Date;
}

const ReviewRatingsSchema = new Schema({
  itemAsDescribed: { type: Number, min: 1, max: 5 },
  communication: { type: Number, min: 1, max: 5 },
  shippingSpeed: { type: Number, min: 1, max: 5 },
  overall: { type: Number, required: true, min: 1, max: 5 },
}, { _id: false });

const ReviewSchema = new Schema<IReview>(
  {
    // Reviewer
    reviewer: { type: Schema.Types.ObjectId, ref: 'ForumUser', required: true, index: true },
    reviewerUsername: { type: String, required: true },
    reviewerAvatar: String,

    // Target
    targetType: {
      type: String,
      enum: ['seller', 'shop', 'buyer'],
      required: true,
    },
    targetUser: { type: Schema.Types.ObjectId, ref: 'ForumUser', index: true },
    targetUsername: String,
    targetShop: { type: Schema.Types.ObjectId, ref: 'Shop', index: true },
    targetShopName: String,

    // Order/Listing reference
    order: { type: Schema.Types.ObjectId, ref: 'Order', index: true },
    listing: { type: Schema.Types.ObjectId, ref: 'Listing' },
    listingTitle: String,

    // Rating
    rating: { type: Number, required: true, min: 1, max: 5, index: true },
    ratings: ReviewRatingsSchema,

    // Content
    title: { type: String, maxlength: 100 },
    content: { type: String, required: true, minlength: 20, maxlength: 2000 },
    pros: [{ type: String, maxlength: 100 }],
    cons: [{ type: String, maxlength: 100 }],
    photos: [{ type: String }],

    // Response
    response: {
      content: { type: String, maxlength: 1000 },
      respondedAt: Date,
      respondedBy: { type: Schema.Types.ObjectId, ref: 'ForumUser' },
    },

    // Verification
    isVerifiedPurchase: { type: Boolean, default: false },

    // Moderation
    isApproved: { type: Boolean, default: true },
    isHidden: { type: Boolean, default: false },
    hiddenReason: String,
    reportCount: { type: Number, default: 0 },
    reports: [{
      userId: { type: Schema.Types.ObjectId, ref: 'ForumUser' },
      reason: String,
      reportedAt: { type: Date, default: Date.now },
    }],

    // Helpful votes
    helpfulCount: { type: Number, default: 0 },
    notHelpfulCount: { type: Number, default: 0 },
    helpfulVotes: [{ type: Schema.Types.ObjectId, ref: 'ForumUser' }],
    notHelpfulVotes: [{ type: Schema.Types.ObjectId, ref: 'ForumUser' }],

    // Edit tracking
    isEdited: { type: Boolean, default: false },
    editedAt: Date,
    originalContent: String,
  },
  {
    timestamps: true,
  }
);

// Indexes
ReviewSchema.index({ targetUser: 1, isHidden: 1, createdAt: -1 });
ReviewSchema.index({ targetShop: 1, isHidden: 1, createdAt: -1 });
ReviewSchema.index({ order: 1 }, { unique: true, sparse: true }); // One review per order
ReviewSchema.index({ reviewer: 1, order: 1 });
ReviewSchema.index({ rating: 1, createdAt: -1 });
ReviewSchema.index({ isVerifiedPurchase: 1, createdAt: -1 });

// Note: Duplicate review prevention is handled in the API route
// The unique sparse index on { order: 1 } also helps prevent duplicates

export const Review: Model<IReview> =
  mongoose.models.Review || mongoose.model<IReview>('Review', ReviewSchema);
