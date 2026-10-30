import { CurrencyPipe } from '@angular/common';
import { Component, Input, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { CartService } from '../../../core/services/cart.service';
import { CatalogService } from '../../../core/services/catalog.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { Product, ProductDetail } from '../../../core/models/product.model';
import { VariantPickerModalComponent } from '../variant-picker-modal/variant-picker-modal.component';

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [RouterLink, CurrencyPipe, VariantPickerModalComponent],
  templateUrl: './product-card.component.html',
  styleUrl: './product-card.component.scss'
})
export class ProductCardComponent {
  @Input({ required: true }) product!: Product;
  @Input({ required: true }) orgCode!: string;
  @Input({ required: true }) orgId!: number;

  adding = false;
  added = false;
  // Populated only when the product turns out to have extra size options beyond its own base
  // price — the list-level Product carries no variant data, so we don't know this until the
  // detail fetch below resolves.
  pickerProduct: ProductDetail | null = null;

  private readonly cart = inject(CartService);
  private readonly catalog = inject(CatalogService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  get discountPercent(): number | null {
    if (!this.product.mrp || this.product.mrp <= this.product.price) {
      return null;
    }
    return Math.round(((this.product.mrp - this.product.price) / this.product.mrp) * 100);
  }

  quickAdd(event: Event): void {
    event.preventDefault();
    event.stopPropagation();

    if (!this.auth.isAuthenticated()) {
      this.router.navigate(['/o', this.orgCode, 'auth', 'mobile'], {
        queryParams: { returnUrl: `/o/${this.orgCode}/p/${this.product.id}` }
      });
      return;
    }

    this.adding = true;
    this.catalog.getProduct(this.product.id).subscribe({
      next: (detail) => {
        this.adding = false;
        // The product's own base price/weight_label counts as one size option on its own, so
        // any extra row in `variants` means there's more than one size to choose from.
        if (detail.variants.length > 0) {
          this.pickerProduct = detail;
          return;
        }
        this.addDirect();
      },
      error: () => (this.adding = false)
    });
  }

  private addDirect(variantId?: number): void {
    this.adding = true;
    this.cart.addToCart(this.orgId, { product_id: this.product.id, variant_id: variantId }).subscribe({
      next: () => {
        this.adding = false;
        this.added = true;
        this.toast.success(`${this.product.name} added to cart`);
        setTimeout(() => (this.added = false), 1500);
      },
      error: () => (this.adding = false)
    });
  }

  onPickerClosed(): void {
    this.pickerProduct = null;
  }

  onPickerAdded(): void {
    this.pickerProduct = null;
    this.added = true;
    setTimeout(() => (this.added = false), 1500);
  }
}
