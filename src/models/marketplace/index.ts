/**
 * Marketplace Models
 *
 * Core models for the automotive marketplace feature:
 * - Listing: Items for sale (parts, accessories, vehicles)
 * - Shop: Partner storefronts with verification
 * - Order: Transaction tracking (external payments)
 * - Message: Buyer/seller conversations
 * - Review: Seller/shop ratings
 * - SavedListing: Wishlist/saved items
 */

// Listing
export {
  Listing,
  type IListing,
  type IListingImage,
  type IListingVideo,
  type IVehicleCompatibility,
  type ListingCategory,
  type ListingCondition,
  type ListingStatus,
} from './Listing';

// Shop
export {
  Shop,
  ShopApplication,
  type IShop,
  type IShopApplication,
  type IShopStaff,
  type IShopVehicleFocus,
  type ShopStatus,
  type BusinessType,
  type StaffRole,
} from './Shop';

// Order
export {
  Order,
  type IOrder,
  type IOrderStatusHistory,
  type IShippingAddress,
  type OrderStatus,
  type PaymentMethod,
} from './Order';

// Messages & Conversations
export {
  Conversation,
  Message,
  type IConversation,
  type IMessage,
  type IMessageAttachment,
  type IMessageOffer,
  type ConversationStatus,
  type OfferStatus,
} from './Message';

// Review
export {
  Review,
  type IReview,
  type IReviewRatings,
  type ReviewTargetType,
} from './Review';

// Saved Listings (Wishlist)
export {
  SavedListing,
  type ISavedListing,
} from './SavedListing';


/**
 * Marketplace Constants
 */
export const LISTING_CATEGORIES = [
  { value: 'parts', label: 'Parts', icon: 'Wrench' },
  { value: 'accessories', label: 'Accessories', icon: 'Sparkles' },
  { value: 'wheels-tires', label: 'Wheels & Tires', icon: 'Circle' },
  { value: 'electronics', label: 'Electronics', icon: 'Cpu' },
  { value: 'tools', label: 'Tools', icon: 'Hammer' },
  { value: 'vehicles', label: 'Vehicles', icon: 'Car' },
  { value: 'apparel', label: 'Apparel', icon: 'Shirt' },
] as const;

export const LISTING_CONDITIONS = [
  { value: 'new', label: 'New', color: 'green' },
  { value: 'like-new', label: 'Like New', color: 'emerald' },
  { value: 'good', label: 'Good', color: 'blue' },
  { value: 'fair', label: 'Fair', color: 'yellow' },
  { value: 'parts-only', label: 'Parts Only', color: 'red' },
] as const;

export const ORDER_STATUSES = [
  { value: 'pending', label: 'Pending', color: 'yellow' },
  { value: 'confirmed', label: 'Confirmed', color: 'blue' },
  { value: 'paid', label: 'Paid', color: 'green' },
  { value: 'shipped', label: 'Shipped', color: 'violet' },
  { value: 'delivered', label: 'Delivered', color: 'emerald' },
  { value: 'completed', label: 'Completed', color: 'green' },
  { value: 'cancelled', label: 'Cancelled', color: 'red' },
  { value: 'disputed', label: 'Disputed', color: 'orange' },
] as const;

export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash', icon: 'Banknote' },
  { value: 'venmo', label: 'Venmo', icon: 'Smartphone' },
  { value: 'paypal', label: 'PayPal', icon: 'CreditCard' },
  { value: 'zelle', label: 'Zelle', icon: 'Building2' },
  { value: 'cashapp', label: 'Cash App', icon: 'DollarSign' },
  { value: 'other', label: 'Other', icon: 'MoreHorizontal' },
] as const;
