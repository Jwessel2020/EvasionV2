import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISavedListing extends Document {
  user: mongoose.Types.ObjectId;
  listing: mongoose.Types.ObjectId;

  // Notification preferences
  notifyOnPriceDrop: boolean;
  notifyOnSale: boolean;
  notifyOnExpiring: boolean;

  // Price tracking
  savedAtPrice: number;
  lowestPrice?: number;
  priceHistory: Array<{
    price: number;
    recordedAt: Date;
  }>;

  // Notes
  note?: string;

  // Folder/collection (for organizing)
  folder?: string;

  createdAt: Date;
  updatedAt: Date;
}

const SavedListingSchema = new Schema<ISavedListing>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'ForumUser',
      required: true,
      index: true,
    },
    listing: {
      type: Schema.Types.ObjectId,
      ref: 'Listing',
      required: true,
      index: true,
    },

    notifyOnPriceDrop: { type: Boolean, default: true },
    notifyOnSale: { type: Boolean, default: true },
    notifyOnExpiring: { type: Boolean, default: false },

    savedAtPrice: { type: Number, required: true },
    lowestPrice: Number,
    priceHistory: [{
      price: { type: Number, required: true },
      recordedAt: { type: Date, default: Date.now },
    }],

    note: { type: String, maxlength: 500 },
    folder: { type: String, maxlength: 50 },
  },
  {
    timestamps: true,
  }
);

// Compound unique index - one save per user per listing
SavedListingSchema.index({ user: 1, listing: 1 }, { unique: true });
SavedListingSchema.index({ user: 1, folder: 1, createdAt: -1 });
SavedListingSchema.index({ user: 1, createdAt: -1 });

// Note: lowestPrice and priceHistory are initialized in the API route when creating saved listings

export const SavedListing: Model<ISavedListing> =
  mongoose.models.SavedListing || mongoose.model<ISavedListing>('SavedListing', SavedListingSchema);
