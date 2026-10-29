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

export const PAYMENT_STATUS_LABELS: Record<number, string> = {
  1: 'Payment pending',
  2: 'Payment authorized',
  3: 'Paid',
  4: 'Payment failed',
  5: 'Refunded'
};
