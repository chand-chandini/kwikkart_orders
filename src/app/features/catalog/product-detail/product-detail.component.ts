import { CurrencyPipe, Location } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { switchMap } from 'rxjs';

import { OrgContextService } from '../../../core/services/org-context.service';
import { CatalogService } from '../../../core/services/catalog.service';
import { CartService } from '../../../core/services/cart.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { Product, ProductDetail, ProductSizeOption, buildSizeOptions } from '../../../core/models/product.model';
import { CartItem } from '../../../core/models/cart.model';
import { ProductCardComponent } from '../../../shared/components/product-card/product-card.component';
import { QtyStepperComponent } from '../../../shared/components/qty-stepper/qty-stepper.component';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';

// Mirrors kkapi public_app/utils/serviceability.js#message -- same reasons, same phrasing style.
const SERVICEABILITY_MESSAGES: Record<string, string> = {
  out_of_range: "it's outside the delivery area",
  no_store_location: "the store hasn't set its location yet",
  no_delivery_radius: "the seller hasn't set a delivery area yet"
};

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [CurrencyPipe, ProductCardComponent, QtyStepperComponent, SpinnerComponent],
  templateUrl: './product-detail.component.html',
  styleUrl: './product-detail.component.scss'
})
export class ProductDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly orgContext = inject(OrgContextService);
  private readonly catalog = inject(CatalogService);
  private readonly cart = inject(CartService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  loading = true;
  product: ProductDetail | null = null;
  similar: Product[] = [];
  sizeOptions: ProductSizeOption[] = [];
  selectedOption: ProductSizeOption | null = null;
  activeImage = '';
  qty = 1;
  adding = false;
  updatingQty = false;

  get orgCode(): string {
    return this.orgContext.getCurrentCode() ?? '';
  }

  get effectivePrice(): number {
    return this.selectedOption?.price ?? this.product?.price ?? 0;
  }

  get effectiveMrp(): number {
    return this.selectedOption?.mrp ?? this.product?.mrp ?? 0;
  }

  get inStock(): boolean {
    if (this.selectedOption) {
      return this.selectedOption.isAvailable && this.selectedOption.stockQty > 0;
    }
    return !!this.product?.is_available && (this.product?.stock_qty ?? 0) > 0;
  }

  // Reflects whatever quantity of the *currently selected* size/pack is already sitting in the
  // cart, so reopening the page (or switching variants) shows the real cart state instead of a
  // one-off "Added" flash that reverts on its own.
  get cartItem(): CartItem | undefined {
    if (!this.product) {
      return undefined;
    }
    const variantId = this.selectedOption?.variantId ?? null;
    return this.cart.cart().items.find(
      (item) => item.product_id === this.product!.id && (item.variant_id ?? null) === variantId
    );
  }

  get cartQty(): number {
    return this.cartItem?.qty ?? 0;
  }

  // null means "no buyer location yet" -- show no badge at all (matches the cart/checkout pages'
  // treatment of unknown serviceability) rather than guessing.
  get deliveryStatus(): 'ok' | 'unavailable' | null {
    const serviceable = this.product?.is_serviceable;
    if (serviceable === null || serviceable === undefined) {
      return null;
    }
    return serviceable ? 'ok' : 'unavailable';
  }

  get deliveryStatusLabel(): string {
    if (this.deliveryStatus === 'ok') {
      return 'Available for delivery';
    }
    return `Can't be delivered — ${SERVICEABILITY_MESSAGES[this.product?.serviceability ?? ''] ?? "it isn't deliverable here"}`;
  }

  goBack(): void {
    this.location.back();
  }

  ngOnInit(): void {
    this.route.paramMap.pipe(switchMap((params) => {
      this.loading = true;
      this.qty = 1;
      const productId = Number(params.get('productId'));
      return this.catalog.getProduct(productId);
    })).subscribe({
      next: (product) => {
        this.product = product;
        this.sizeOptions = buildSizeOptions(product);
        this.selectedOption =
          this.sizeOptions.find((o) => o.isAvailable && o.stockQty > 0) ?? this.sizeOptions[0] ?? null;
        this.activeImage = product.image_url ?? product.images[0]?.image_url ?? '';
        this.loading = false;
        this.catalog.similarProducts(product.id).subscribe((products) => (this.similar = products));
      },
      error: () => (this.loading = false)
    });
  }

  selectOption(option: ProductSizeOption): void {
    this.selectedOption = option;
    this.qty = 1;
  }

  addToCart(): void {
    if (!this.product) {
      return;
    }
    if (!this.auth.isAuthenticated()) {
      this.router.navigate(['/o', this.orgCode, 'auth', 'mobile'], {
        queryParams: { returnUrl: `/o/${this.orgCode}/p/${this.product.id}` }
      });
      return;
    }

    this.adding = true;
    this.cart
      .addToCart(this.product.org_id, {
        product_id: this.product.id,
        variant_id: this.selectedOption?.variantId ?? undefined,
        qty: this.qty
      })
      .subscribe({
        next: () => {
          this.adding = false;
          this.toast.success(`${this.product!.name} added to cart`);
        },
        error: () => (this.adding = false)
      });
  }

  onCartQtyChange(newQty: number): void {
    const item = this.cartItem;
    if (!item || !this.product) {
      return;
    }
    this.updatingQty = true;
    const request$ =
      newQty <= 0
        ? this.cart.removeItem(this.product.org_id, item.id)
        : this.cart.updateQty(this.product.org_id, item.id, newQty);
    request$.subscribe({
      next: () => (this.updatingQty = false),
      error: () => (this.updatingQty = false)
    });
  }
}
