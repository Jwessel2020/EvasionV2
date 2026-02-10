import mongoose, { Schema, Document, Model } from 'mongoose';

export type ShopStatus = 'pending' | 'active' | 'suspended' | 'closed';
export type BusinessType = 'individual' | 'business';
export type StaffRole = 'admin' | 'manager' | 'staff';

export interface IShopStaff {
  userId: mongoose.Types.ObjectId;
  username: string;
  role: StaffRole;
  permissions: string[];
  addedAt: Date;
  addedBy: mongoose.Types.ObjectId;
}

export interface IShopVehicleFocus {
  make: string;
  model?: string;
}

export interface IShop extends Document {
  // Basic info
  name: string;
  slug: string;
  description: string;
  shortDescription?: string;

  // Branding
  logo?: string;
  banner?: string;
  primaryColor?: string;

  // Owner & Staff
  owner: mongoose.Types.ObjectId;
  ownerUsername: string;
  staff: IShopStaff[];

  // Business info
  businessName?: string;
  businessType: BusinessType;

  // Contact
  email: string;
  phone?: string;
  website?: string;
  socialLinks: {
    instagram?: string;
    facebook?: string;
    youtube?: string;
    tiktok?: string;
  };

  // Location
  location: {
    address?: string;
    city?: string;
    state?: string;
    country: string;
    postalCode?: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
  };

  // Verification
  isVerified: boolean;
  verifiedAt?: Date;
  verifiedBy?: mongoose.Types.ObjectId;
  verificationLevel: 'none' | 'email' | 'phone' | 'id' | 'business';

  // Specialties
  categories: string[];
  brands: string[];
  vehicleFocus: IShopVehicleFocus[];

  // Stats
  listingCount: number;
  activeListings: number;
  soldCount: number;
  totalSales: number;
  averageRating: number;
  reviewCount: number;
  followerCount: number;
  responseRate: number;
  responseTime: number; // in hours

  // Settings
  settings: {
    acceptsOffers: boolean;
    minOfferPercent: number;
    allowMessages: boolean;
    showPhone: boolean;
    showEmail: boolean;
    vacationMode: boolean;
    vacationMessage?: string;
    vacationUntil?: Date;
    autoReplyMessage?: string;
  };

  // Policies
  policies: {
    returns?: string;
    shipping?: string;
    payment?: string;
  };

  // Status
  status: ShopStatus;
  suspendedReason?: string;
  suspendedUntil?: Date;
  closedAt?: Date;
  closedReason?: string;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

const ShopStaffSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'ForumUser', required: true },
  username: { type: String, required: true },
  role: { type: String, enum: ['admin', 'manager', 'staff'], default: 'staff' },
  permissions: [{ type: String }],
  addedAt: { type: Date, default: Date.now },
  addedBy: { type: Schema.Types.ObjectId, ref: 'ForumUser' },
}, { _id: false });

const VehicleFocusSchema = new Schema({
  make: { type: String, required: true },
  model: String,
}, { _id: false });

const ShopSchema = new Schema<IShop>(
  {
    // Basic info
    name: { type: String, required: true, maxlength: 100, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true },
    description: { type: String, required: true, maxlength: 2000 },
    shortDescription: { type: String, maxlength: 200 },

    // Branding
    logo: String,
    banner: String,
    primaryColor: { type: String, default: '#8b5cf6' }, // violet-500

    // Owner & Staff
    owner: { type: Schema.Types.ObjectId, ref: 'ForumUser', required: true, index: true },
    ownerUsername: { type: String, required: true },
    staff: [ShopStaffSchema],

    // Business info
    businessName: String,
    businessType: { type: String, enum: ['individual', 'business'], default: 'individual' },

    // Contact
    email: { type: String, required: true },
    phone: String,
    website: String,
    socialLinks: {
      instagram: String,
      facebook: String,
      youtube: String,
      tiktok: String,
    },

    // Location
    location: {
      address: String,
      city: String,
      state: { type: String, index: true },
      country: { type: String, default: 'US' },
      postalCode: String,
      coordinates: {
        lat: Number,
        lng: Number,
      },
    },

    // Verification
    isVerified: { type: Boolean, default: false, index: true },
    verifiedAt: Date,
    verifiedBy: { type: Schema.Types.ObjectId, ref: 'ForumUser' },
    verificationLevel: {
      type: String,
      enum: ['none', 'email', 'phone', 'id', 'business'],
      default: 'none',
    },

    // Specialties
    categories: [{ type: String }],
    brands: [{ type: String }],
    vehicleFocus: [VehicleFocusSchema],

    // Stats
    listingCount: { type: Number, default: 0 },
    activeListings: { type: Number, default: 0 },
    soldCount: { type: Number, default: 0 },
    totalSales: { type: Number, default: 0 },
    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0 },
    followerCount: { type: Number, default: 0 },
    responseRate: { type: Number, default: 100, min: 0, max: 100 },
    responseTime: { type: Number, default: 24 },

    // Settings
    settings: {
      acceptsOffers: { type: Boolean, default: true },
      minOfferPercent: { type: Number, default: 70, min: 0, max: 100 },
      allowMessages: { type: Boolean, default: true },
      showPhone: { type: Boolean, default: false },
      showEmail: { type: Boolean, default: true },
      vacationMode: { type: Boolean, default: false },
      vacationMessage: String,
      vacationUntil: Date,
      autoReplyMessage: String,
    },

    // Policies
    policies: {
      returns: String,
      shipping: String,
      payment: String,
    },

    // Status
    status: {
      type: String,
      enum: ['pending', 'active', 'suspended', 'closed'],
      default: 'pending',
      index: true,
    },
    suspendedReason: String,
    suspendedUntil: Date,
    closedAt: Date,
    closedReason: String,
  },
  {
    timestamps: true,
  }
);

// Indexes
ShopSchema.index({ name: 'text', description: 'text' });
ShopSchema.index({ status: 1, isVerified: 1, createdAt: -1 });
ShopSchema.index({ categories: 1 });
ShopSchema.index({ brands: 1 });
ShopSchema.index({ 'vehicleFocus.make': 1 });
ShopSchema.index({ averageRating: -1 });
ShopSchema.index({ soldCount: -1 });

// Note: Slug generation is handled in the API route when creating shops

export const Shop: Model<IShop> =
  mongoose.models.Shop || mongoose.model<IShop>('Shop', ShopSchema);


// Shop Application model for verification flow
export interface IShopApplication extends Document {
  applicant: mongoose.Types.ObjectId;
  applicantUsername: string;

  // Business info
  shopName: string;
  businessName?: string;
  businessType: BusinessType;
  description: string;
  categories: string[];

  // Contact
  email: string;
  phone?: string;
  website?: string;

  // Location
  location: {
    city?: string;
    state?: string;
    country: string;
  };

  // Documents
  documents: Array<{
    type: 'business_license' | 'id' | 'proof_of_address' | 'other';
    url: string;
    name: string;
    uploadedAt: Date;
  }>;

  // Review
  status: 'pending' | 'in_review' | 'approved' | 'rejected' | 'more_info';
  reviewNotes?: string;
  internalNotes?: string;
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedAt?: Date;

  // Result
  shopId?: mongoose.Types.ObjectId;
  rejectionReason?: string;

  createdAt: Date;
  updatedAt: Date;
}

const ShopApplicationSchema = new Schema<IShopApplication>(
  {
    applicant: { type: Schema.Types.ObjectId, ref: 'ForumUser', required: true, index: true },
    applicantUsername: { type: String, required: true },

    shopName: { type: String, required: true, maxlength: 100 },
    businessName: String,
    businessType: { type: String, enum: ['individual', 'business'], required: true },
    description: { type: String, required: true, maxlength: 2000 },
    categories: [{ type: String }],

    email: { type: String, required: true },
    phone: String,
    website: String,

    location: {
      city: String,
      state: String,
      country: { type: String, default: 'US' },
    },

    documents: [{
      type: { type: String, enum: ['business_license', 'id', 'proof_of_address', 'other'] },
      url: { type: String, required: true },
      name: String,
      uploadedAt: { type: Date, default: Date.now },
    }],

    status: {
      type: String,
      enum: ['pending', 'in_review', 'approved', 'rejected', 'more_info'],
      default: 'pending',
      index: true,
    },
    reviewNotes: String,
    internalNotes: String,
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'ForumUser' },
    reviewedAt: Date,

    shopId: { type: Schema.Types.ObjectId, ref: 'Shop' },
    rejectionReason: String,
  },
  {
    timestamps: true,
  }
);

ShopApplicationSchema.index({ status: 1, createdAt: -1 });

export const ShopApplication: Model<IShopApplication> =
  mongoose.models.ShopApplication || mongoose.model<IShopApplication>('ShopApplication', ShopApplicationSchema);
