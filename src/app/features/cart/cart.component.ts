import { CurrencyPipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { OrgContextService } from '../../core/services/org-context.service';
import { CartService } from '../../core/services/cart.service';
import { CartItem, CartVendorGroup } from '../../core/models/cart.model';
import { AppError } from '../../core/models/api-error.model';
import { SpinnerComponent } from '../../shared/components/spinner/spinner.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { QtyStepperComponent } from '../../shared/components/qty-stepper/qty-stepper.component';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CurrencyPipe, RouterLink, SpinnerComponent, EmptyStateComponent, QtyStepperComponent],
  templateUrl: './cart.component.html'
})
export class CartComponent implements OnInit {
  private readonly orgContext = inject(OrgContextService);
  readonly cartService = inject(CartService);
  private readonly router = inject(Router);

  loading = true;
  busyItemId: number | null = null;

  get orgCode(): string {
    return this.orgContext.getCurrentCode() ?? '';
  }

  ngOnInit(): void {
    this.cartService.load(this.orgContext.requireOrgId()).subscribe({
      next: () => (this.loading = false),
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
}
