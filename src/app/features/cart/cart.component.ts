import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { OrgContextService } from '../../core/services/org-context.service';
import { CartService } from '../../core/services/cart.service';
import { CartCouponsService } from '../../core/services/cart-coupons.service';
import { TryBuyCartService } from '../../core/services/try-buy-cart.service';
import { CartItem, CartVendorGroup } from '../../core/models/cart.model';
import { SellerCouponQuote } from '../../core/models/coupon.model';
import { AppError } from '../../core/models/api-error.model';
import { SpinnerComponent } from '../../shared/components/spinner/spinner.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { QtyStepperComponent } from '../../shared/components/qty-stepper/qty-stepper.component';
import { TryBuyCartComponent } from '../try-buy/try-buy-cart/try-buy-cart.component';

export type CartTab = 'cart' | 'try-buy';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CurrencyPipe, DecimalPipe, FormsModule, RouterLink, SpinnerComponent, EmptyStateComponent, QtyStepperComponent, TryBuyCartComponent],
  templateUrl: './cart.component.html'
})
export class CartComponent implements OnInit {
  private readonly orgContext = inject(OrgContextService);
  private readonly route = inject(ActivatedRoute);
  readonly cartService = inject(CartService);
  readonly coupons = inject(CartCouponsService);
  readonly tryBuyCart = inject(TryBuyCartService);
  private readonly router = inject(Router);

  loading = true;
  busyItemId: number | null = null;
  couponInput = '';
  couponVendorSheet: number | null = null; // vendor id whose coupon list is open, if any
  sheetCode = '';

  // Cart and Try & Buy are shown as a switch on one page rather than separate routes --
  // preselectable via ?tab=try-buy (e.g. the header's Try & Buy link) and read reactively so
  // clicking that link while already on this page switches tabs without a full reload.
  tab: CartTab = 'cart';

  get orgCode(): string {
    return this.orgContext.getCurrentCode() ?? '';
  }

  private get orgId(): number {
    return this.orgContext.requireOrgId();
  }

  setTab(tab: CartTab): void {
    this.tab = tab;
    this.router.navigate([], { relativeTo: this.route, queryParams: { tab }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      this.tab = params.get('tab') === 'try-buy' ? 'try-buy' : 'cart';
    });
    this.cartService.load(this.orgId).subscribe({
      next: () => {
        this.loading = false;
        this.coupons.attach(this.orgId);
      },
      error: () => (this.loading = false)
    });
  }

  itemsForVendor(vendor: CartVendorGroup) {
    return this.cartService.cart().items.filter((item) => item.vendor_id === vendor.vendor_id);
  }

  unitPrice(item: CartItem): number {
    return item.variant_id ? (item.variant_price ?? item.product_price) : item.product_price;
  }

  lineTotal(item: CartItem): number {
    return this.unitPrice(item) * item.qty;
  }

  updateQty(itemId: number, qty: number): void {
    this.busyItemId = itemId;
    this.cartService.updateQty(this.orgContext.requireOrgId(), itemId, qty).subscribe({
      next: () => (this.busyItemId = null),
      error: (err) => this.recoverFromStaleItem(err)
    });
  }

  remove(itemId: number): void {
    this.busyItemId = itemId;
    this.cartService.removeItem(this.orgContext.requireOrgId(), itemId).subscribe({
      next: () => (this.busyItemId = null),
      error: (err) => this.recoverFromStaleItem(err)
    });
  }

  // A cart row can go stale in one open tab when it's changed elsewhere (another tab, the item
  // got ordered, the cart was cleared) — the backend then 404s "cart item not found" on an action
  // against it. Re-sync from the server instead of leaving that row stuck disabled with a cryptic
  // error: the item simply drops out of the list once the real cart reloads.
  private recoverFromStaleItem(err: AppError): void {
    this.busyItemId = null;
    if (err.status === 404) {
      this.cartService.load(this.orgContext.requireOrgId()).subscribe();
    }
  }

  checkout(): void {
    this.router.navigate(['/o', this.orgCode, 'checkout']);
  }

  // ---- coupons (ported from kkpublicapp's CheckoutScreen.jsx cart section, 2026-11-19) ----

  // This line's share of its seller's coupon discount -- 0 once the item total is 0 (removed).
  couponOff(item: CartItem): number {
    const lineTotal = this.lineTotal(item);
    return lineTotal > 0 ? this.coupons.itemDiscount(item.id) : 0;
  }

  availableCount(vendorId: number): number {
    return this.coupons.couponsFor(vendorId).filter((c) => c.applicable).length;
  }

  hasCoupons(vendorId: number): boolean {
    return this.coupons.couponsFor(vendorId).length > 0;
  }

  chosenSellerCode(vendorId: number): string | undefined {
    return this.coupons.sellerCodes()[vendorId];
  }

  sellerCoupon(vendorId: number): SellerCouponQuote | null {
    return this.coupons.quoteFor(vendorId)?.coupon ?? null;
  }

  // The quote hasn't caught up with the code just chosen yet (debounced server round trip).
  sellerCouponPending(vendorId: number): boolean {
    const q = this.sellerCoupon(vendorId);
    return !q || q.code !== this.chosenSellerCode(vendorId);
  }

  sellerCouponOk(vendorId: number): boolean {
    return !this.sellerCouponPending(vendorId) && !!this.sellerCoupon(vendorId)?.applied;
  }

  // The single "Have a coupon?" box: typing a seller's own code applies it to that seller,
  // anything else is tried as a platform coupon on whatever is left.
  applyCode(): void {
    const code = this.couponInput.trim();
    if (!code) return;
    this.coupons.applyCode(this.orgId, code);
    this.couponInput = '';
  }

  openCouponSheet(vendorId: number): void {
    this.couponVendorSheet = vendorId;
    this.sheetCode = '';
  }

  closeCouponSheet(): void {
    this.couponVendorSheet = null;
    this.sheetCode = '';
  }

  pickSellerCoupon(vendorId: number, code: string): void {
    this.coupons.applySellerCoupon(this.orgId, vendorId, code);
    this.closeCouponSheet();
  }

  applySheetCode(): void {
    if (this.couponVendorSheet == null || !this.sheetCode.trim()) return;
    this.pickSellerCoupon(this.couponVendorSheet, this.sheetCode);
  }

  removeSellerCoupon(vendorId: number): void {
    this.coupons.removeSellerCoupon(this.orgId, vendorId);
  }

  removePlatformCode(): void {
    this.coupons.removePlatformCode(this.orgId);
  }
}
