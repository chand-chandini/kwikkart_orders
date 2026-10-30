import { CurrencyPipe } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';

import { CartService } from '../../../core/services/cart.service';
import { ToastService } from '../../../core/services/toast.service';
import { ProductDetail, ProductSizeOption, buildSizeOptions } from '../../../core/models/product.model';
import { QtyStepperComponent } from '../qty-stepper/qty-stepper.component';

@Component({
  selector: 'app-variant-picker-modal',
  standalone: true,
  imports: [CurrencyPipe, QtyStepperComponent],
  templateUrl: './variant-picker-modal.component.html',
  styleUrl: './variant-picker-modal.component.scss'
})
export class VariantPickerModalComponent implements OnInit {
  @Input({ required: true }) product!: ProductDetail;
  @Input({ required: true }) orgId!: number;
  @Output() closed = new EventEmitter<void>();
  @Output() added = new EventEmitter<void>();

  private readonly cart = inject(CartService);
  private readonly toast = inject(ToastService);

  sizeOptions: ProductSizeOption[] = [];
  selectedOption: ProductSizeOption | null = null;
  qty = 1;
  adding = false;
  activeImage = '';

  ngOnInit(): void {
    this.sizeOptions = buildSizeOptions(this.product);
    this.selectedOption =
      this.sizeOptions.find((o) => o.isAvailable && o.stockQty > 0) ?? this.sizeOptions[0] ?? null;
    this.activeImage = this.product.image_url ?? this.product.images[0]?.image_url ?? '';
  }

  get effectivePrice(): number {
    return this.selectedOption?.price ?? this.product.price;
  }

  get effectiveMrp(): number {
    return this.selectedOption?.mrp ?? this.product.mrp;
  }

  get inStock(): boolean {
    if (this.selectedOption) {
      return this.selectedOption.isAvailable && this.selectedOption.stockQty > 0;
    }
    return this.product.is_available && this.product.stock_qty > 0;
  }

  selectOption(option: ProductSizeOption): void {
    this.selectedOption = option;
    this.qty = 1;
  }

  close(): void {
    this.closed.emit();
  }

  confirm(): void {
    if (!this.inStock || this.adding) {
      return;
    }
    this.adding = true;
    this.cart
      .addToCart(this.orgId, {
        product_id: this.product.id,
        variant_id: this.selectedOption?.variantId ?? undefined,
        qty: this.qty
      })
      .subscribe({
        next: () => {
          this.adding = false;
          this.toast.success(`${this.product.name} added to cart`);
          this.added.emit();
        },
        error: () => (this.adding = false)
      });
  }
}
