// Mirrors kkapi public_app/utils/couponMath.js#couponCard / previewCartCoupons -- the same
// shapes the public app's cart coupon UI renders from (TryAtHomeCartScreen is unrelated; the
// real reference is CheckoutScreen.jsx's cart section, which is where coupons are applied).

export interface ComboMissingItem {
  product_id: number;
  name: string | null;
  qty: number;
}

// GET /ecommerce/cart/coupons -- one card per live coupon of a seller in the cart, already
// evaluated against the cart (applicable + why not, no coupon code needed yet).
export interface SellerCouponCard {
  id: number;
  vendor_id: number;
  code: string;
  title: string | null;
  description: string | null;
  offer_text: string;
  discount_type: number;
  discount_value: number;
  min_order_amount: number | null;
  max_discount_amount: number | null;
  valid_to: string | null;
  applicable: boolean;
  status: string | null;
  reason: string | null;
  shortfall: number;
  eligible_subtotal: number;
  discount: number;
  is_combo: boolean;
  combo_text: string | null;
  sets: number;
  missing: ComboMissingItem[];
}

export interface SellerCoupons {
  vendor_id: number;
  vendor_name: string;
  items_total: number;
  coupons: SellerCouponCard[];
}

// POST /ecommerce/cart/coupons/preview response -- what a chosen seller coupon code actually
// does to that seller's bill, priced from the live cart (allocations land in item_discounts).
export interface SellerCouponQuote {
  code: string;
  title: string | null;
  offer_text: string | null;
  applied: boolean;
  status: string | null;
  reason: string | null;
  shortfall: number;
  eligible_subtotal: number;
  discount: number;
  is_combo: boolean;
  combo_text: string | null;
  sets: number;
}

export interface SellerQuoteLine {
  vendor_id: number;
  vendor_name: string;
  items_total: number;
  coupon: SellerCouponQuote | null;
  discount: number;
  payable: number;
}

export interface PlatformCouponQuote {
  code: string;
  applied: boolean;
  reason: string | null;
  discount: number;
}

export interface UnmatchedCoupon {
  vendor_id: number;
  code: string;
  reason: string | null;
}

export interface CartCouponsPreview {
  sellers: SellerQuoteLine[];
  unmatched_coupons: UnmatchedCoupon[];
  // Keyed by cart item id (as a string, same as a plain JSON object key) -> that line's share of
  // its seller's coupon discount.
  item_discounts: Record<string, number>;
  items_total: number;
  seller_discount_total: number;
  platform_coupon: PlatformCouponQuote | null;
  total_discount: number;
  delivery_total: number;
  grand_total: number;
}

export interface SellerCouponRequest {
  vendor_id: number;
  code: string;
}
