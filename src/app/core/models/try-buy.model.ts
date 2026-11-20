// Try & Buy (ported from kkpublicapp's tryAtHomeSlice.js / api/endpoints/tryBuy.js). Entirely
// separate from the normal shopping cart: its own local selection list, its own server quote
// endpoint, and a "request" (never an order the buyer pays for) instead of checkout.

import { ProductDetail, buildSizeOptions } from './product.model';

export const TRY_BUY_MAX_QTY = 5; // mirrors kkapi utils/tryBuy.js MAX_QTY

// Embedded on ProductDetail.try_buy by GET /ecommerce/products/:id (tryBuyCtrl.productTryBuy) --
// never derived client-side from the product's own flags.
export interface TryBuyInfo {
  available: boolean;
  label: string;
  delivery_charge: number | null;
  variant_ids: number[];
  colors: string[];
}

export interface TryBuyQuoteItem {
  product_id: number;
  variant_id: number | null;
  color: string | null;
  qty: number;
}

export interface TryBuyQuoteLine {
  key: string;
  product_id: number;
  variant_id: number | null;
  color: string | null;
  qty: number;
  name: string | null;
  brand: string | null;
  variant_name: string | null;
  image_url: string | null;
  price: number;
  mrp: number | null;
  line_value: number;
  department_id: number | null;
  available: boolean;
  reason: string | null;
}

export interface TryBuySeller {
  vendor_id: number | null;
  vendor_name: string | null;
  org_id: number | null;
  items: TryBuyQuoteLine[];
  items_count: number;
  items_value: number;
  delivery_charge: number;
}

export interface TryBuyQuote {
  label: string;
  sellers: TryBuySeller[];
  items_value: number;
  delivery_total: number;
  unavailable_count: number;
}

export type TryBuySlotState = 'available' | 'full' | 'closed' | 'ended' | 'disabled';

export interface TryBuySlot {
  slot_id: number;
  label: string;
  start_time: string;
  end_time: string;
  state: TryBuySlotState;
  remaining: number;
  capacity: number;
  booking_closes_at: string;
}

export interface TryBuySlotDay {
  date: string;
  weekday: string;
  slots: TryBuySlot[];
}

export interface TryBuySlotsResponse {
  today: string;
  days: TryBuySlotDay[];
}

export interface TryBuySlotPick {
  slot_id: number;
  date: string;
  label: string;
}

// The local-only selection line -- product, size, colour, qty. Price/mrp are display hints until
// the live quote loads; availability/charges always come from the server.
export interface TryBuyCartLine {
  lineId: string;
  productId: number;
  variantId: number | null;
  variantName: string | null;
  color: string | null;
  vendorId: number;
  vendorName: string | null;
  orgId: number | null;
  name: string;
  brand: string | null;
  image: string | null;
  price: number;
  mrp: number | null;
  sizeOptions: { id: number | null; name: string }[];
  colors: string[];
  quantity: number;
}

export interface TryBuySizeOption {
  id: number | null;
  name: string | null;
  price: number;
  mrp: number | null;
  available: boolean;
}

// The sizes of one colour (one ProductDetail) that the server offers for Try & Buy, ported from
// kkpublicapp's TryBuySelectSheet.jsx#trySizesOf. The DEFAULT row (id null -- the product's own
// base price, same "no variant" buildSizeOptions already exposes) qualifies when the product
// itself is opted in; if the colour also has extra size variants, the default only counts as a
// real size when it's named (an unnamed default is just the base price, not a size -- matches
// kkapi's utils/tryBuy.js#checkItem).
export function tryBuySizesOf(detail: ProductDetail): TryBuySizeOption[] {
  const tb = detail.try_buy;
  if (!tb?.available) {
    return [];
  }
  const variants = detail.variants ?? [];
  const allowed = new Set(tb.variant_ids ?? []);
  const isNamed = (v: string | null | undefined) => v != null && String(v).trim() !== '';
  const inStock = (qty: number | null | undefined) => qty == null || Number(qty) > 0;
  return buildSizeOptions(detail)
    .filter((o) => (o.variantId === null ? !variants.length || isNamed(detail.weight_label) : allowed.has(o.variantId)))
    .map((o) => ({
      id: o.variantId,
      name: o.variantId === null ? detail.weight_label || null : o.name,
      price: o.price,
      mrp: o.mrp,
      available: o.variantId === null ? !!detail.is_available && inStock(detail.stock_qty) : o.isAvailable && o.stockQty > 0
    }));
}

export function lineIdOf(productId: number, variantId: number | null, color: string | null): string {
  return `${productId}|${variantId ?? ''}|${color ?? ''}`;
}

export function toQuoteItems(items: TryBuyCartLine[]): TryBuyQuoteItem[] {
  return items.map((it) => ({
    product_id: it.productId,
    variant_id: it.variantId,
    color: it.color,
    qty: it.quantity
  }));
}

export interface CreateTryBuyRequestBody {
  items: TryBuyQuoteItem[];
  address_id: number;
  slot_id: number;
  slot_date: string;
  note?: string;
}

export type TryBuyRequestStatus = 'requested' | 'accepted' | 'rejected' | 'cancelled';

export interface TryBuyRequestLine {
  product_id: number;
  variant_id: number | null;
  product_name: string;
  variant_name: string | null;
  color: string | null;
  qty: number;
  price: number;
  image_url: string | null;
}

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "2026-11-12" -> "Thu, 12 Nov"; today/tomorrow by name when `today` ("YYYY-MM-DD") is given.
// Ported from kkpublicapp's tryBuySlots.js#dayLabel.
export function dayLabel(ymd: string | null | undefined, today?: string | null): string {
  if (!ymd) {
    return '';
  }
  const [y, mo, d] = ymd.split('-').map(Number);
  if (today) {
    if (ymd === today) {
      return 'Today';
    }
    const [ty, tm, td] = today.split('-').map(Number);
    const t = new Date(Date.UTC(ty, tm - 1, td));
    t.setUTCDate(t.getUTCDate() + 1);
    const tomorrow = `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
    if (ymd === tomorrow) {
      return 'Tomorrow';
    }
  }
  const wd = new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
  return `${DAY_SHORT[wd]}, ${d} ${MONTHS_SHORT[mo - 1]}`;
}

export const SLOT_STATE_TEXT: Record<string, string | null> = {
  available: null,
  full: 'Full',
  closed: 'Booking closed',
  ended: 'Ended',
  disabled: 'Unavailable'
};

// Server error codes that mean "the slot you picked changed" -- reload the slots.
export const SLOT_ERROR_CODES = ['SLOT_FULL', 'SLOT_UNAVAILABLE', 'SLOT_REQUIRED'];

export interface TryBuyRequest {
  id: number;
  vendor_id: number;
  vendor_name: string;
  status: TryBuyRequestStatus;
  order_id: number | null;
  order_number: string | null;
  order_status: number | null;
  items: TryBuyRequestLine[];
  items_value: number;
  delivery_charge: number;
  slot_date: string | null;
  slot_label: string | null;
  note: string | null;
  rejected_reason: string | null;
  created_at: string;
}
