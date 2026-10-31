export interface Category {
  id: number;
  name: string;
  icon: string | null;
  image_url: string | null;
  tint_color: string | null;
  order_by: number;
}

export interface Subcategory {
  id: number;
  category_id: number;
  name: string;
  icon: string | null;
  image_url: string | null;
  tint_color: string | null;
  order_by: number;
}

export interface Banner {
  id: number;
  org_id: number;
  banner_image: string;
  title: string | null;
}

export interface Vendor {
  id: number;
  org_id: number;
  business_name: string;
  category: string | null;
  city: string | null;
  org_name: string | null;
  product_count: number;
}

export interface ProductVariant {
  id: number;
  name: string;
  price: number;
  mrp: number | null;
  unit_price_label: string | null;
  stock_qty: number;
  is_available: boolean;
}

export interface ProductImage {
  id: number;
  image_url: string;
}

export interface Product {
  id: number;
  vendor_id: number;
  org_id: number;
  category_id: number;
  subcategory_id: number;
  name: string;
  brand: string | null;
  // Only present where the query joins vendors_t (product detail, similar products) -- plain
  // catalog listings don't carry it.
  vendor_name?: string;
  product_code: string | null;
  master_product_id: number | null;
  weight_label: string | null;
  price: number;
  mrp: number;
  other_price_min: number | null;
  other_price_max: number | null;
  unit_price_label: string | null;
  discount_label: string | null;
  rating_avg: number | null;
  rating_count: number | null;
  is_bulk_only: boolean;
  is_ad: boolean;
  stock_qty: number;
  is_available: boolean;
  image_url: string | null;
  is_serviceable?: boolean;
  serviceability?: string;
  distance_km?: number;
}

export interface ProductDetail extends Product {
  variants: ProductVariant[];
  images: ProductImage[];
  highlights: string[];
  description: string | null;
  storage_info: string | null;
  manufacturer_details: string | null;
  expiry_date: string | null;
  energy_kcal: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  protein_g: number | null;
  is_wishlisted: boolean;
}

// A product's own price/weight_label (e.g. "100ml") is the first size option, stored on the
// product row itself rather than as a row in ecommerce_product_variants_t -- only the *other*
// pack sizes (e.g. "200ml", "500ml") live there. A null variantId means "this option is the
// product's own base price," which is exactly what AddToCartPayload.variant_id already treats
// as "no variant" -- so selecting it needs no special-casing on add-to-cart.
export interface ProductSizeOption {
  variantId: number | null;
  name: string;
  price: number;
  mrp: number | null;
  stockQty: number;
  isAvailable: boolean;
}

export function buildSizeOptions(product: ProductDetail): ProductSizeOption[] {
  const base: ProductSizeOption = {
    variantId: null,
    name: product.weight_label || 'Standard',
    price: product.price,
    mrp: product.mrp,
    stockQty: product.stock_qty,
    isAvailable: product.is_available
  };
  const variantOptions: ProductSizeOption[] = product.variants.map((v) => ({
    variantId: v.id,
    name: v.name,
    price: v.price,
    mrp: v.mrp,
    stockQty: v.stock_qty,
    isAvailable: v.is_available
  }));
  return [base, ...variantOptions];
}

export interface ProductListFilters {
  vendorId?: number;
  categoryId?: number;
  subcategoryId?: number;
  q?: string;
  page?: number;
  limit?: number;
  lat?: number;
  lng?: number;
}
