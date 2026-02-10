import mongoose, { Schema, Document, Model } from 'mongoose';

export type OrderStatus =
  | 'pending'      // Buyer initiated, waiting for seller confirmation
  | 'confirmed'    // Seller confirmed, payment pending (external)
  | 'paid'         // Payment confirmed by seller
  | 'shipped'      // Item shipped
  | 'delivered'    // Item delivered
  | 'completed'    // Transaction complete, can leave review
  | 'cancelled'    // Cancelled by either party
  | 'disputed';    // Under dispute

export type PaymentMethod = 'cash' | 'venmo' | 'paypal' | 'zelle' | 'cashapp' | 'other';

export interface IOrderStatusHistory {
  status: OrderStatus;
  timestamp: Date;
  note?: string;
  by: mongoose.Types.ObjectId;
}

export interface IShippingAddress {
  name: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string;
}

export interface IOrder extends Document {
  // Order identifier
  orderNumber: string;

  // Parties
  buyer: mongoose.Types.ObjectId;
  buyerUsername: string;
  seller: mongoose.Types.ObjectId;
  sellerUsername: string;
  shop?: mongoose.Types.ObjectId;
  shopName?: string;

  // Listing reference
  listing: mongoose.Types.ObjectId;
  listingSlug: string;

  // Item snapshot (in case listing changes/deleted)
  itemSnapshot: {
    title: string;
    image?: string;
    condition: string;
    category: string;
  };

  // Pricing (for record keeping)
  agreedPrice: number;
  shippingCost: number;
  total: number;
  currency: string;
  originalListingPrice: number;

  // Quantity
  quantity: number;

  // Payment (external - just tracking)
  paymentMethod?: PaymentMethod;
  paymentNote?: string;
  paymentConfirmedAt?: Date;

  // Shipping
  shippingMethod: 'local_pickup' | 'shipping';
  shippingAddress?: IShippingAddress;
  trackingNumber?: string;
  trackingUrl?: string;
  carrier?: string;
  estimatedDelivery?: Date;

  // Status
  status: OrderStatus;
  statusHistory: IOrderStatusHistory[];

  // Notes
  buyerNote?: string;
  sellerNote?: string;
  internalNote?: string;

  // Dispute
  disputeReason?: string;
  disputeDetails?: string;
  disputeOpenedAt?: Date;
  disputeResolvedAt?: Date;
  disputeResolution?: string;

  // Timestamps
  confirmedAt?: Date;
  paidAt?: Date;
  shippedAt?: Date;
  deliveredAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  cancelledBy?: mongoose.Types.ObjectId;
  cancellationReason?: string;

  // Review tracking
  buyerReviewed: boolean;
  sellerReviewed: boolean;

  createdAt: Date;
  updatedAt: Date;
}

const ShippingAddressSchema = new Schema({
  name: { type: String, required: true },
  address1: { type: String, required: true },
  address2: String,
  city: { type: String, required: true },
  state: { type: String, required: true },
  postalCode: { type: String, required: true },
  country: { type: String, default: 'US' },
  phone: String,
}, { _id: false });

const StatusHistorySchema = new Schema({
  status: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  note: String,
  by: { type: Schema.Types.ObjectId, ref: 'ForumUser', required: true },
}, { _id: false });

const OrderSchema = new Schema<IOrder>(
  {
    orderNumber: { type: String, required: true, unique: true },

    // Parties
    buyer: { type: Schema.Types.ObjectId, ref: 'ForumUser', required: true, index: true },
    buyerUsername: { type: String, required: true },
    seller: { type: Schema.Types.ObjectId, ref: 'ForumUser', required: true, index: true },
    sellerUsername: { type: String, required: true },
    shop: { type: Schema.Types.ObjectId, ref: 'Shop', index: true },
    shopName: String,

    // Listing
    listing: { type: Schema.Types.ObjectId, ref: 'Listing', required: true, index: true },
    listingSlug: { type: String, required: true },

    // Item snapshot
    itemSnapshot: {
      title: { type: String, required: true },
      image: String,
      condition: String,
      category: String,
    },

    // Pricing
    agreedPrice: { type: Number, required: true, min: 0 },
    shippingCost: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'USD' },
    originalListingPrice: { type: Number, required: true },

    quantity: { type: Number, default: 1, min: 1 },

    // Payment
    paymentMethod: {
      type: String,
      enum: ['cash', 'venmo', 'paypal', 'zelle', 'cashapp', 'other'],
    },
    paymentNote: String,
    paymentConfirmedAt: Date,

    // Shipping
    shippingMethod: {
      type: String,
      enum: ['local_pickup', 'shipping'],
      required: true,
    },
    shippingAddress: ShippingAddressSchema,
    trackingNumber: String,
    trackingUrl: String,
    carrier: String,
    estimatedDelivery: Date,

    // Status
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'paid', 'shipped', 'delivered', 'completed', 'cancelled', 'disputed'],
      default: 'pending',
      index: true,
    },
    statusHistory: [StatusHistorySchema],

    // Notes
    buyerNote: { type: String, maxlength: 500 },
    sellerNote: { type: String, maxlength: 500 },
    internalNote: String,

    // Dispute
    disputeReason: String,
    disputeDetails: { type: String, maxlength: 2000 },
    disputeOpenedAt: Date,
    disputeResolvedAt: Date,
    disputeResolution: String,

    // Timestamps
    confirmedAt: Date,
    paidAt: Date,
    shippedAt: Date,
    deliveredAt: Date,
    completedAt: Date,
    cancelledAt: Date,
    cancelledBy: { type: Schema.Types.ObjectId, ref: 'ForumUser' },
    cancellationReason: String,

    // Review tracking
    buyerReviewed: { type: Boolean, default: false },
    sellerReviewed: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

// Indexes
OrderSchema.index({ buyer: 1, status: 1, createdAt: -1 });
OrderSchema.index({ seller: 1, status: 1, createdAt: -1 });
OrderSchema.index({ status: 1, createdAt: -1 });
OrderSchema.index({ orderNumber: 1 });

// Note: Order number generation is handled in the API route when creating orders
// orderNumber format: ORD-YYYY-XXXXXX
// total = agreedPrice + shippingCost

export const Order: Model<IOrder> =
  mongoose.models.Order || mongoose.model<IOrder>('Order', OrderSchema);
