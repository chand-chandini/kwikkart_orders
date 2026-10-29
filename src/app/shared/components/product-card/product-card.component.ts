import { CurrencyPipe } from '@angular/common';
import { Component, Input, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { CartService } from '../../../core/services/cart.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { Product } from '../../../core/models/product.model';

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [RouterLink, CurrencyPipe],
  templateUrl: './product-card.component.html',
  styleUrl: './product-card.component.scss'
})
export class ProductCardComponent {
  @Input({ required: true }) product!: Product;
  @Input({ required: true }) orgCode!: string;
  @Input({ required: true }) orgId!: number;

  adding = false;
  added = false;

  private readonly cart = inject(CartService);
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
    this.cart.addToCart(this.orgId, { product_id: this.product.id }).subscribe({
      next: () => {
        this.adding = false;
        this.added = true;
        this.toast.success(`${this.product.name} added to cart`);
        setTimeout(() => (this.added = false), 1500);
      },
      error: () => (this.adding = false)
    });
  }
}
