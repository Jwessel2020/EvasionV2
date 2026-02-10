import mongoose, { Schema, Document, Model } from 'mongoose';

// Listing categories for automotive marketplace
export type ListingCategory =
  | 'parts'
  | 'accessories'
  | 'wheels-tires'
  | 'electronics'
  | 'tools'
  | 'vehicles'
  | 'apparel';

export type ListingCondition = 'new' | 'like-new' | 'good' | 'fair' | 'parts-only';
export type ListingStatus = 'draft' | 'active' | 'pending' | 'sold' | 'expired' | 'removed';

export interface IVehicleCompatibility {
  year?: number;
  yearMin?: number;
  yearMax?: number;
  make: string;
  model?: string;
  trim?: string;
}

export interface IListingImage {
  url: string;
  thumbnail?: string;
  order: number;
}

export interface IListingVideo {
  url: string;
  provider: 'upload' | 'youtube' | 'other';
  thumbnail?: string;
}

export interface IListing extends Document {
  // Basic info
  title: string;
  slug: string;
  description: string;
  descriptionHtml?: string;

  // Seller info (denormalized for performance)
  seller: mongoose.Types.ObjectId;
  sellerUsername: string;
  sellerAvatar?: string;
  sellerReputation: number;

  // Shop (if from partner shop)
  shop?: mongoose.Types.ObjectId;
  shopName?: string;
  shopSlug?: string;

  // Category & Type
  category: ListingCategory;
  subcategory?: string;
  listingType: 'user' | 'shop';

  // Item details
  condition: ListingCondition;
  brand?: string;
  partNumber?: string;
  quantity: number;

  // Vehicle compatibility
  compatibility: {
    universal: boolean;
    vehicles: IVehicleCompatibility[];
  };

  // Pricing
  price: number;
  currency: string;
  originalPrice?: number;
  priceNegotiable: boolean;
  acceptsOffers: boolean;

  // Location
  location: {
    city?: string;
    state?: string;
    country: string;
    postalCode?: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
  };

  // Shipping options
  shipping: {
    localPickup: boolean;
    willShip: boolean;
    shipsTo: string[];
    shippingCost?: number;
    freeShipping: boolean;
    estimatedDays?: number;
  };

  // Media
  images: IListingImage[];
  videos: IListingVideo[];

  // Status
  status: ListingStatus;
  soldTo?: mongoose.Types.ObjectId;
  soldAt?: Date;
  soldPrice?: number;

  // Visibility & Promotion
  isFeatured: boolean;
  featuredUntil?: Date;
  bumpedAt?: Date;
  bumpCount: number;

  // Engagement stats
  viewCount: number;
  saveCount: number;
  inquiryCount: number;
  offerCount: number;

  // Expiration
  expiresAt?: Date;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

const VehicleCompatibilitySchema = new Schema({
  year: Number,
  yearMin: Number,
  yearMax: Number,
  make: { type: String, required: true },
  model: String,
  trim: String,
}, { _id: false });

const ListingImageSchema = new Schema({
  url: { type: String, required: true },
  thumbnail: String,
  order: { type: Number, default: 0 },
}, { _id: false });

const ListingVideoSchema = new Schema({
  url: { type: String, required: true },
  provider: { type: String, enum: ['upload', 'youtube', 'other'], default: 'upload' },
  thumbnail: String,
}, { _id: false });

const ListingSchema = new Schema<IListing>(
  {
    // Basic info
    title: { type: String, required: true, maxlength: 150, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true },
    description: { type: String, required: true, maxlength: 5000 },
    descriptionHtml: String,

    // Seller info
    seller: { type: Schema.Types.ObjectId, ref: 'ForumUser', required: true, index: true },
    sellerUsername: { type: String, required: true },
    sellerAvatar: String,
    sellerReputation: { type: Number, default: 0 },

    // Shop info
    shop: { type: Schema.Types.ObjectId, ref: 'Shop', index: true },
    shopName: String,
    shopSlug: String,

    // Category
    category: {
      type: String,
      enum: ['parts', 'accessories', 'wheels-tires', 'electronics', 'tools', 'vehicles', 'apparel'],
      required: true,
      index: true,
    },
    subcategory: String,
    listingType: { type: String, enum: ['user', 'shop'], default: 'user' },

    // Item details
    condition: {
      type: String,
      enum: ['new', 'like-new', 'good', 'fair', 'parts-only'],
      required: true,
    },
    brand: { type: String, index: true },
    partNumber: String,
    quantity: { type: Number, default: 1, min: 1 },

    // Vehicle compatibility
    compatibility: {
      universal: { type: Boolean, default: false },
      vehicles: [VehicleCompatibilitySchema],
    },

    // Pricing
    price: { type: Number, required: true, min: 0, index: true },
    currency: { type: String, default: 'USD' },
    originalPrice: Number,
    priceNegotiable: { type: Boolean, default: false },
    acceptsOffers: { type: Boolean, default: true },

    // Location
    location: {
      city: String,
      state: { type: String, index: true },
      country: { type: String, default: 'US' },
      postalCode: String,
      coordinates: {
        lat: Number,
        lng: Number,
      },
    },

    // Shipping
    shipping: {
      localPickup: { type: Boolean, default: true },
      willShip: { type: Boolean, default: false },
      shipsTo: [{ type: String }],
      shippingCost: Number,
      freeShipping: { type: Boolean, default: false },
      estimatedDays: Number,
    },

    // Media
    images: [ListingImageSchema],
    videos: [ListingVideoSchema],

    // Status
    status: {
      type: String,
      enum: ['draft', 'active', 'pending', 'sold', 'expired', 'removed'],
      default: 'active',
      index: true,
    },
    soldTo: { type: Schema.Types.ObjectId, ref: 'ForumUser' },
    soldAt: Date,
    soldPrice: Number,

    // Visibility
    isFeatured: { type: Boolean, default: false },
    featuredUntil: Date,
    bumpedAt: Date,
    bumpCount: { type: Number, default: 0 },

    // Engagement
    viewCount: { type: Number, default: 0 },
    saveCount: { type: Number, default: 0 },
    inquiryCount: { type: Number, default: 0 },
    offerCount: { type: Number, default: 0 },

    // Expiration
    expiresAt: { type: Date, index: true },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
ListingSchema.index({ status: 1, category: 1, createdAt: -1 });
ListingSchema.index({ status: 1, 'location.state': 1, createdAt: -1 });
ListingSchema.index({ seller: 1, status: 1, createdAt: -1 });
ListingSchema.index({ shop: 1, status: 1, createdAt: -1 });
ListingSchema.index({ 'compatibility.vehicles.make': 1, 'compatibility.vehicles.model': 1 });
ListingSchema.index({ title: 'text', description: 'text', brand: 'text' });
ListingSchema.index({ bumpedAt: -1, createdAt: -1 }); // For sorting by activity

// Note: Slug generation is handled in the API route when creating listings

export const Listing: Model<IListing> =
  mongoose.models.Listing || mongoose.model<IListing>('Listing', ListingSchema);
