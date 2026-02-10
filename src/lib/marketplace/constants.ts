/**
 * Marketplace Constants
 * Separated from models to allow client-side usage
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

export type ListingCategory = typeof LISTING_CATEGORIES[number]['value'];
export type ListingCondition = typeof LISTING_CONDITIONS[number]['value'];
export type OrderStatus = typeof ORDER_STATUSES[number]['value'];
export type PaymentMethod = typeof PAYMENT_METHODS[number]['value'];
