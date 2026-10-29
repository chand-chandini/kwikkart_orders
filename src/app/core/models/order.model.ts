export type PaymentMethod = 'cod' | 'online';

export interface OrderCreateRequest {
  address_id: number;
  payment_method: PaymentMethod;
  delivery_slot_id?: number;
  org_id?: number;
  coupon_code?: string;
  instructions?: string;
  use_wallet?: boolean;
}

export interface VendorOrderSummary {
  order_id: number;
  order_number: string;
  grand_total: number;
  vendor_id: number;
}

export interface OrderCreateResponse {
  parent_order_id: number;
  parent_order_number: string;
  grand_total: number;
  order_id: number;
  order_number: string;
  wallet_amount: number;
  wallet_coins: number;
  payable_amount: number;
  orders: VendorOrderSummary[];
  paid_by_wallet?: boolean;
  payment_id?: number;
  rzp_order_id?: string;
  key_id?: string;
  amount?: number;
}

export interface OrderVendorStatus {
  order_id: number;
  order_number: string;
  vendor_id: number;
  vendor_name: string;
  status: number;
  grand_total: number;
  item_count: number;
}

export interface Order {
  id: number;
  parent_order_id: number;
  order_number: string;
  grand_total: number;
  payment_status: number;
  placed_at: string;
  image_url: string | null;
  item_count: number;
  status: number | null;
  vendors: OrderVendorStatus[];
  vendor_count: number;
}

export interface OrderLineItem {
  id: number;
  product_id: number;
  variant_id: number | null;
  product_name: string;
  weight_label: string | null;
  image_url: string | null;
  unit_price: number;
  mrp: number;
  qty: number;
  line_total: number;
}

export interface ParentOrderVendorEntry {
  id: number;
  order_number: string;
  vendor_id: number;
  vendor_name: string;
  status: number;
  items_total: number;
  delivery_charge: number;
  grand_total: number;
  items: OrderLineItem[];
  payment_method: string;
}

export interface ParentOrder {
  id: number;
  order_number: string;
  grand_total: number;
  payment_status: number;
  vendor_orders: ParentOrderVendorEntry[];
  payment_summary: unknown;
  address: unknown;
}

export interface OrderDetail {
  id: number;
  order_number: string;
  vendor_name: string;
  status: number;
  items_total: number;
  delivery_charge: number;
  grand_total: number;
  placed_at: string;
  payment_method: string;
  items: OrderLineItem[];
  address: unknown;
}

export interface DeliverySlot {
  id: number;
  label: string;
  start_time: string;
  end_time: string;
}

export interface CouponResult {
  discount_amount: number;
  code: string;
}

export interface WalletTransaction {
  id: number;
  txn_type: string;
  source: string;
  coins: number;
  amount: number;
  balance_after: number;
  order_id: number | null;
  parent_order_id: number | null;
  note: string | null;
  i_ts: string;
  order_number: string | null;
}

export interface WalletInfo {
  balance_coins: number;
  coin_value: number;
  balance_amount: number;
  transactions: WalletTransaction[];
}
