// Mirrors the Super Admin invoice's status enums (ecommerce-orders.component.ts) so the same
// numeric codes from ecommerce_orders_t.status / payments_t.status read identically here.
export const ORDER_STATUS_LABELS: Record<number, string> = {
  1: 'Placed',
  2: 'Confirmed',
  3: 'Packed',
  4: 'Out for delivery',
  5: 'Delivered',
  6: 'Cancelled'
};

export const ORDER_STATUS_BADGE: Record<number, string> = {
  1: 'bg-warning text-dark',
  2: 'bg-primary',
  3: 'bg-info text-dark',
  4: 'bg-info text-dark',
  5: 'bg-success',
  6: 'bg-danger'
};

// Soft pill variant (light bg, colored text) used on the order detail page, separate from
// ORDER_STATUS_BADGE's solid Bootstrap badges so the order list page is unaffected.
export const ORDER_STATUS_PILL: Record<number, string> = {
  1: 'order-status-pill--placed',
  2: 'order-status-pill--confirmed',
  3: 'order-status-pill--packed',
  4: 'order-status-pill--packed',
  5: 'order-status-pill--delivered',
  6: 'order-status-pill--cancelled'
};

export const PAYMENT_STATUS_LABELS: Record<number, string> = {
  1: 'Payment pending',
  2: 'Payment authorized',
  3: 'Paid',
  4: 'Payment failed',
  5: 'Refunded'
};

// COD orders sit at payment_status 1 ("pending") until the courier collects cash on delivery --
// that's its normal, expected state, not something wrong, so it reads as "Cash on Delivery"
// instead of the alarming-sounding "Payment pending". Online orders still show their real
// status (Paid / Payment pending / Payment failed / Refunded), since that's actually meaningful
// there.
export function paymentDisplayLabel(
  method: string | null | undefined,
  status: number | null | undefined
): string | null {
  if (method === 'cod') {
    return 'Cash on Delivery';
  }
  return status != null ? PAYMENT_STATUS_LABELS[status] ?? null : null;
}
