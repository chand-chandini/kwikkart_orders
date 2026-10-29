export interface CartItem {
  id: number;
  product_id: number;
  variant_id: number | null;
  vendor_id: number;
  name: string;
  weight_label: string | null;
  image_url: string | null;
  // The cart endpoint names these product_price/variant_price (not price) and never returns a
  // line_total — see CartComponent.unitPrice()/lineTotal() for the variant-aware computation.
  product_price: number;
  variant_price: number | null;
  qty: number;
  stock_qty: number | null;
  max_qty: number;
  is_available: number;
}

export interface CartVendorGroup {
  vendor_id: number;
  vendor_name: string;
  item_count: number;
  items_total: number;
  delivery_charge: number;
}

export interface CartState {
  items: CartItem[];
  items_total: number;
  vendors: CartVendorGroup[];
  delivery_total: number;
  grand_total: number;
  address_location_missing: boolean;
}

export interface AddToCartPayload {
  product_id: number;
  variant_id?: number;
  qty?: number;
}
