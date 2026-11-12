import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';

import {
  DISCOUNT_BUCKETS,
  ProductFilterFacets,
  ProductFilterState,
  activeFilterCount,
  emptyProductFilterState
} from '../../../core/models/product.model';

// Amazon/Flipkart-style listing filters: brand checkboxes (with counts, from the facets the
// page fetched for its current category/subcategory/search), a price range with its own Apply
// (so it doesn't re-fetch on every keystroke), and discount buckets ("10% or more"). Brand/
// discount apply immediately on click, same as Amazon's checkboxes.
@Component({
  selector: 'app-product-filter-panel',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './product-filter-panel.component.html'
})
export class ProductFilterPanelComponent implements OnChanges {
  @Input() facets: ProductFilterFacets | null = null;
  @Input() filters: ProductFilterState = emptyProductFilterState();
  @Output() filtersChange = new EventEmitter<ProductFilterState>();

  readonly discountBuckets = DISCOUNT_BUCKETS;
  priceMinInput = '';
  priceMaxInput = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['filters']) {
      this.priceMinInput = this.filters.minPrice != null ? String(this.filters.minPrice) : '';
      this.priceMaxInput = this.filters.maxPrice != null ? String(this.filters.maxPrice) : '';
    }
  }

  get hasActiveFilters(): boolean {
    return activeFilterCount(this.filters) > 0;
  }

  isBrandChecked(name: string): boolean {
    const key = name.trim().toLowerCase();
    return this.filters.brands.some((b) => b.toLowerCase() === key);
  }

  toggleBrand(name: string): void {
    const key = name.trim().toLowerCase();
    const checked = this.isBrandChecked(name);
    const brands = checked ? this.filters.brands.filter((b) => b.toLowerCase() !== key) : [...this.filters.brands, name];
    this.emit({ ...this.filters, brands });
  }

  selectDiscount(bucket: number): void {
    const minDiscount = this.filters.minDiscount === bucket ? null : bucket;
    this.emit({ ...this.filters, minDiscount });
  }

  applyPrice(): void {
    const minPrice = this.priceMinInput.trim() ? Number(this.priceMinInput) : null;
    const maxPrice = this.priceMaxInput.trim() ? Number(this.priceMaxInput) : null;
    this.emit({ ...this.filters, minPrice, maxPrice });
  }

  // Resets brand/price/discount only -- sort lives in the separate toolbar (ProductSortBarComponent)
  // and isn't something "Clear all" on the filter panel is expected to touch.
  clearAll(): void {
    this.priceMinInput = '';
    this.priceMaxInput = '';
    this.emit({ ...emptyProductFilterState(), sort: this.filters.sort });
  }

  private emit(next: ProductFilterState): void {
    this.filtersChange.emit(next);
  }
}
