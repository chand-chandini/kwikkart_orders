import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ProductSort, SORT_OPTIONS } from '../../../core/models/product.model';

// Sits above a product listing grid (category/search) -- a sort dropdown plus a "Filters"
// toggle for the panel next to it. The toggle only matters on narrow screens (the filter panel
// is always visible on desktop; see .category-browse__filters / .search-results__filters in
// styles.scss), but it's harmless to always render here and let CSS decide when it's shown.
@Component({
  selector: 'app-product-sort-bar',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './product-sort-bar.component.html'
})
export class ProductSortBarComponent {
  @Input() sort: ProductSort = 'relevance';
  @Input() resultCount: number | null = null;
  @Input() activeFilterCount = 0;
  @Output() sortChange = new EventEmitter<ProductSort>();
  @Output() toggleFilters = new EventEmitter<void>();

  readonly sortOptions = SORT_OPTIONS;
}
