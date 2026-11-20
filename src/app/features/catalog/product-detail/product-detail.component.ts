import { CurrencyPipe, Location } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { switchMap } from 'rxjs';

import { OrgContextService } from '../../../core/services/org-context.service';
import { CatalogService } from '../../../core/services/catalog.service';
import { CartService } from '../../../core/services/cart.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { TryBuyCartService } from '../../../core/services/try-buy-cart.service';
import { ColourOption, Product, ProductDetail, ProductSizeOption, buildSizeOptions } from '../../../core/models/product.model';
import { tryBuySizesOf } from '../../../core/models/try-buy.model';
import { CartItem } from '../../../core/models/cart.model';
import { ProductCardComponent } from '../../../shared/components/product-card/product-card.component';
import { QtyStepperComponent } from '../../../shared/components/qty-stepper/qty-stepper.component';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';
import { TryBuySelectSheetComponent, TrySelection } from '../../../shared/components/try-buy-select-sheet/try-buy-select-sheet.component';

// Mirrors kkapi public_app/utils/serviceability.js#message -- same reasons, same phrasing style.
const SERVICEABILITY_MESSAGES: Record<string, string> = {
  out_of_range: "it's outside the delivery area",
  no_store_location: "the store hasn't set its location yet",
  no_delivery_radius: "the seller hasn't set a delivery area yet"
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [CurrencyPipe, ProductCardComponent, QtyStepperComponent, SpinnerComponent, TryBuySelectSheetComponent],
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
  readonly tryBuyCart = inject(TryBuyCartService);

  loading = true;
  product: ProductDetail | null = null;
  similar: Product[] = [];
  sizeOptions: ProductSizeOption[] = [];
  selectedOption: ProductSizeOption | null = null;
  activeImage = '';
  qty = 1;
  adding = false;
  updatingQty = false;

  // Try & Buy -- independent of the normal Add-to-cart size/qty state above. Selection itself
  // happens in the TryBuySelectSheet modal (multi colour x size at once); this page only owns
  // whether that sheet is open.
  tryBuySheetOpen = false;

  // Other colours of this design (server-driven; see ColourOption's own comment). Switching
  // colour re-navigates to that sibling's product id rather than touching local state.
  colourOptions: ColourOption[] = [];

  get orgCode(): string {
    return this.orgContext.getCurrentCode() ?? '';
  }

  get effectivePrice(): number {
    return this.selectedOption?.price ?? this.product?.price ?? 0;
  }

  get effectiveMrp(): number {
    return this.selectedOption?.mrp ?? this.product?.mrp ?? 0;
  }

  get effectiveUnitPriceLabel(): string | null {
    return this.selectedOption?.unitPriceLabel ?? null;
  }

  get discountPercent(): number {
    const mrp = this.effectiveMrp;
    const price = this.effectivePrice;
    return mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0;
  }

  get expiryLabel(): string | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(this.product?.expiry_date ?? '');
    if (!match) {
      return null;
    }
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31) {
      return null;
    }
    return `${day} ${MONTHS[month - 1]} ${match[1]}`;
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
        this.colourOptions = product.colour_options ?? [];
        this.tryBuySheetOpen = false;
        this.loading = false;
        // The listing card's "Try & Buy" button links here with ?tryBuy=1 to jump straight into
        // the sheet, same shortcut kkpublicapp's card gives -- same auth/availability guard as
        // clicking the button on this page would go through.
        if (this.route.snapshot.queryParamMap.get('tryBuy') === '1') {
          this.openTryBuySheet();
        }
        this.catalog.similarProducts(product.id).subscribe((products) => (this.similar = products));
      },
      error: () => (this.loading = false)
    });
  }

  // Swaps the whole page to a sibling colour's own product id (server treats colours as separate
  // product rows sharing a style_group_id, never as a variant of this one) -- ngOnInit's
  // paramMap subscription re-fetches and re-renders exactly as a direct nav to /p/:id would.
  get selectedColourName(): string | null {
    return this.colourOptions.find((o) => o.product_id === this.product?.id)?.colour ?? null;
  }

  selectColour(opt: ColourOption): void {
    if (!this.product || opt.product_id === this.product.id) {
      return;
    }
    this.router.navigate(['/o', this.orgCode, 'p', opt.product_id]);
  }

  openTryBuySheet(): void {
    if (!this.product?.try_buy?.available) {
      return;
    }
    if (!this.auth.isAuthenticated()) {
      this.router.navigate(['/o', this.orgCode, 'auth', 'mobile'], {
        queryParams: { returnUrl: `/o/${this.orgCode}/p/${this.product.id}` }
      });
      return;
    }
    this.tryBuySheetOpen = true;
  }

  get tryBuyOtherSeller(): string | null {
    return this.product ? this.tryBuyCart.otherSellerName(this.product.vendor_id) : null;
  }

  onTryBuyConfirmed(selections: TrySelection[]): void {
    this.tryBuySheetOpen = false;
    if (!selections.length) {
      return;
    }
    const vendorId = selections[0].product.vendor_id;
    if (this.tryBuyCart.otherSellerName(vendorId)) {
      this.tryBuyCart.clearOtherSellers(vendorId);
    }
    const counts = { added: 0, increased: 0, max: 0 };
    for (const sel of selections) {
      const result = this.tryBuyCart.add({
        productId: sel.product.id,
        variantId: sel.size.id,
        variantName: sel.size.name,
        color: sel.colourName,
        vendorId: sel.product.vendor_id,
        vendorName: sel.product.vendor_name ?? null,
        orgId: sel.product.org_id,
        name: sel.product.name,
        brand: sel.product.brand,
        image: sel.product.images[0]?.image_url ?? sel.product.image_url,
        price: sel.size.price,
        mrp: sel.size.mrp,
        sizeOptions: tryBuySizesOf(sel.product).map((s) => ({ id: s.id, name: s.name || sel.product.name })),
        colors: sel.product.try_buy?.colors ?? []
      });
      counts[result] += 1;
    }
    const label = this.product?.try_buy?.label || 'Try & Buy';
    const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
    const parts = [
      counts.added ? `${plural(counts.added, 'item', 'items')} added` : null,
      counts.increased ? `quantity increased for ${plural(counts.increased, 'item', 'items')}` : null,
      counts.max ? `${plural(counts.max, 'item is', 'items are')} already at the maximum` : null
    ].filter((p): p is string => !!p);
    this.toast.success(`${parts.join('; ')} to ${label}`);
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
