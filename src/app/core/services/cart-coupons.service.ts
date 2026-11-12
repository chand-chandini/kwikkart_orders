import { HttpClient } from '@angular/common/http';
import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { Observable, map, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import { CartCouponsPreview, SellerCouponRequest, SellerCoupons } from '../models/coupon.model';
import { CartService } from './cart.service';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Seller + platform coupons on the cart (kkapi public_app 2026-11-19), ported from
// kkpublicapp's CheckoutScreen.jsx cart section: a seller's code only ever discounts that
// seller's own lines, a platform code discounts whatever is left, and every amount shown comes
// from the server's own preview of the live cart -- nothing is computed here.
@Injectable({ providedIn: 'root' })
export class CartCouponsService {
  private readonly http = inject(HttpClient);
  private readonly cartService = inject(CartService);

  private readonly _sellerCoupons = signal<SellerCoupons[] | null>(null); // listCartCoupons
  private readonly _sellerCodes = signal<Record<number, string>>({}); // { vendor_id: code }
  private readonly _platformCode = signal<string | null>(null);
  private readonly _quote = signal<CartCouponsPreview | null>(null);

  readonly sellerCoupons = this._sellerCoupons.asReadonly();
  readonly sellerCodes = this._sellerCodes.asReadonly();
  readonly platformCode = this._platformCode.asReadonly();
  readonly quote = this._quote.asReadonly();

  readonly platformApplied = computed(() => !!this.quote()?.platform_coupon?.applied);
  readonly platformDiscount = computed(() => (this.platformApplied() ? Number(this.quote()!.platform_coupon!.discount) || 0 : 0));
  readonly sellerDiscountTotal = computed(() => Number(this.quote()?.seller_discount_total) || 0);
  readonly totalDiscount = computed(() => round2(this.sellerDiscountTotal() + this.platformDiscount()));

  // Only coupons the server says apply go to the order -- it checks them all again anyway.
  readonly appliedSellerCoupons = computed<SellerCouponRequest[]>(() =>
    (this.quote()?.sellers ?? [])
      .filter((s) => s.coupon?.applied)
      .map((s) => ({ vendor_id: s.vendor_id, code: s.coupon!.code }))
  );

  private lastOrgId: number | null = null;

  constructor() {
    // Re-price whenever the cart's items/quantities change (qty edit, remove, add) -- same
    // trigger as CheckoutScreen.jsx's `cartKey` effect, just driven off CartService's signal
    // instead of a redux cartKey prop.
    const cartKey = computed(() => this.cartService.cart().items.map((it) => `${it.id}:${it.qty}`).join(','));
    effect(() => {
      cartKey();
      if (this.lastOrgId != null) this.refreshQuote(this.lastOrgId);
    });
  }

  // Call once the cart page (or checkout, if reached directly) knows the org -- loads the live
  // coupon list for display and re-prices any coupon already applied this session.
  attach(orgId: number): void {
    this.lastOrgId = orgId;
    this.loadAvailable(orgId).subscribe();
    this.refreshQuote(orgId);
  }

  loadAvailable(orgId: number): Observable<SellerCoupons[]> {
    return this.http
      .get<{ data: { sellers: SellerCoupons[] } }>(`${environment.apiBaseUrl}/ecommerce/cart/coupons`, {
        params: { org_id: orgId }
      })
      .pipe(
        map((res) => res.data.sellers),
        tap((sellers) => this._sellerCoupons.set(sellers))
      );
  }

  couponsFor(vendorId: number) {
    return this._sellerCoupons()?.find((s) => s.vendor_id === vendorId)?.coupons ?? [];
  }

  quoteFor(vendorId: number) {
    return this.quote()?.sellers?.find((s) => s.vendor_id === vendorId) ?? null;
  }

  itemDiscount(itemId: number): number {
    return Number(this.quote()?.item_discounts?.[itemId]) || 0;
  }

  // The single "Have a coupon?" box: a seller's own code goes to that seller, anything else is
  // tried as a platform coupon.
  applyCode(orgId: number, rawCode: string): void {
    const code = rawCode.trim().toUpperCase();
    if (!code) return;
    const seller = (this._sellerCoupons() ?? []).find((s) => s.coupons.some((c) => c.code === code));
    if (seller) {
      this.applySellerCoupon(orgId, seller.vendor_id, code);
      return;
    }
    this.applyPlatformCode(orgId, code);
  }

  applySellerCoupon(orgId: number, vendorId: number, code: string): void {
    this._sellerCodes.update((cur) => ({ ...cur, [vendorId]: code.trim().toUpperCase() }));
    this.refreshQuote(orgId);
  }

  removeSellerCoupon(orgId: number, vendorId: number): void {
    this._sellerCodes.update((cur) => {
      const next = { ...cur };
      delete next[vendorId];
      return next;
    });
    this.refreshQuote(orgId);
  }

  applyPlatformCode(orgId: number, code: string): void {
    this._platformCode.set(code.trim().toUpperCase());
    this.refreshQuote(orgId);
  }

  removePlatformCode(orgId: number): void {
    this._platformCode.set(null);
    this.refreshQuote(orgId);
  }

  private refreshQuote(orgId: number): void {
    this.lastOrgId = orgId;
    const sellerCoupons: SellerCouponRequest[] = Object.entries(this._sellerCodes()).map(([vendorId, code]) => ({
      vendor_id: Number(vendorId),
      code
    }));
    const couponCode = this._platformCode();
    if (!this.cartService.cart().items.length || (!sellerCoupons.length && !couponCode)) {
      this._quote.set(null);
      return;
    }
    this.http
      .post<{ data: CartCouponsPreview }>(`${environment.apiBaseUrl}/ecommerce/cart/coupons/preview`, {
        org_id: orgId,
        seller_coupons: sellerCoupons,
        coupon_code: couponCode || undefined
      })
      .pipe(map((res) => res.data))
      .subscribe({
        next: (quote) => this._quote.set(quote),
        // A seller coupon stopped applying (expired, used up, cart fell below its minimum): leave
        // the previous quote in place rather than silently clearing the discount shown.
        error: () => {}
      });
  }

  reset(): void {
    this._sellerCoupons.set(null);
    this._sellerCodes.set({});
    this._platformCode.set(null);
    this._quote.set(null);
    this.lastOrgId = null;
  }
}
