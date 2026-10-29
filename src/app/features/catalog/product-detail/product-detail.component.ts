import { CurrencyPipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { switchMap } from 'rxjs';

import { OrgContextService } from '../../../core/services/org-context.service';
import { CatalogService } from '../../../core/services/catalog.service';
import { CartService } from '../../../core/services/cart.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { Product, ProductDetail, ProductVariant } from '../../../core/models/product.model';
import { ProductCardComponent } from '../../../shared/components/product-card/product-card.component';
import { QtyStepperComponent } from '../../../shared/components/qty-stepper/qty-stepper.component';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [CurrencyPipe, ProductCardComponent, QtyStepperComponent, SpinnerComponent],
  templateUrl: './product-detail.component.html'
})
export class ProductDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly orgContext = inject(OrgContextService);
  private readonly catalog = inject(CatalogService);
  private readonly cart = inject(CartService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  loading = true;
  product: ProductDetail | null = null;
  similar: Product[] = [];
  selectedVariant: ProductVariant | null = null;
  activeImage = '';
  qty = 1;
  adding = false;
  added = false;

  get orgCode(): string {
    return this.orgContext.getCurrentCode() ?? '';
  }

  get effectivePrice(): number {
    return this.selectedVariant?.price ?? this.product?.price ?? 0;
  }

  get effectiveMrp(): number {
    return this.selectedVariant?.mrp ?? this.product?.mrp ?? 0;
  }

  get inStock(): boolean {
    if (this.selectedVariant) {
      return this.selectedVariant.is_available && this.selectedVariant.stock_qty > 0;
    }
    return !!this.product?.is_available && (this.product?.stock_qty ?? 0) > 0;
  }

  ngOnInit(): void {
    this.route.paramMap.pipe(switchMap((params) => {
      this.loading = true;
      this.added = false;
      this.qty = 1;
      const productId = Number(params.get('productId'));
      return this.catalog.getProduct(productId);
    })).subscribe({
      next: (product) => {
        this.product = product;
        this.selectedVariant = product.variants.find((v) => v.is_available) ?? product.variants[0] ?? null;
        this.activeImage = product.image_url ?? product.images[0] ?? '';
        this.loading = false;
        this.catalog.similarProducts(product.id).subscribe((products) => (this.similar = products));
      },
      error: () => (this.loading = false)
    });
  }

  selectVariant(variant: ProductVariant): void {
    this.selectedVariant = variant;
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
        variant_id: this.selectedVariant?.id,
        qty: this.qty
      })
      .subscribe({
        next: () => {
          this.adding = false;
          this.added = true;
          this.toast.success(`${this.product!.name} added to cart`);
          setTimeout(() => (this.added = false), 1500);
        },
        error: () => (this.adding = false)
      });
  }
}
