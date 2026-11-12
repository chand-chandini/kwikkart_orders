import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { switchMap } from 'rxjs';

import { OrgContextService } from '../../../core/services/org-context.service';
import { CatalogService } from '../../../core/services/catalog.service';
import {
  Product,
  ProductFilterFacets,
  ProductFilterState,
  ProductSort,
  activeFilterCount,
  emptyProductFilterState
} from '../../../core/models/product.model';
import { ProductCardComponent } from '../../../shared/components/product-card/product-card.component';
import { ProductSortBarComponent } from '../../../shared/components/product-sort-bar/product-sort-bar.component';
import { ProductFilterPanelComponent } from '../../../shared/components/product-filter-panel/product-filter-panel.component';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [ProductCardComponent, ProductSortBarComponent, ProductFilterPanelComponent, SpinnerComponent, EmptyStateComponent],
  templateUrl: './search.component.html'
})
export class SearchComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly orgContext = inject(OrgContextService);
  private readonly catalog = inject(CatalogService);

  query = '';
  loading = true;
  products: Product[] = [];

  filters: ProductFilterState = emptyProductFilterState();
  facets: ProductFilterFacets | null = null;
  showFilters = false;

  get activeFilterCount(): number {
    return activeFilterCount(this.filters);
  }

  get orgCode(): string {
    return this.orgContext.getCurrentCode() ?? '';
  }

  // Below ~768px the filter panel becomes a fixed bottom-sheet (see .search-results__filters--open
  // in styles.scss) -- locking body scroll while it's open stops the page behind it from
  // scrolling along with the sheet's own internal scroll.
  toggleFilters(): void {
    this.showFilters = !this.showFilters;
    document.body.style.overflow = this.showFilters ? 'hidden' : '';
  }

  closeIfBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.toggleFilters();
    }
  }

  ngOnDestroy(): void {
    document.body.style.overflow = '';
  }

  ngOnInit(): void {
    this.route.queryParamMap.pipe(switchMap((params) => {
      this.query = params.get('q') ?? '';
      this.filters = emptyProductFilterState(); // a new search term is a fresh browsing context
      this.loading = true;
      const orgId = this.orgContext.requireOrgId();
      this.catalog
        .getProductFilters(orgId, { q: this.query || undefined })
        .subscribe({ next: (facets) => (this.facets = facets), error: () => (this.facets = null) });
      return this.fetchProducts$(orgId);
    })).subscribe({
      next: (products) => {
        this.products = products;
        this.loading = false;
      },
      error: () => (this.loading = false)
    });
  }

  onSortChange(sort: ProductSort): void {
    this.filters = { ...this.filters, sort };
    this.refetch();
  }

  onFiltersChange(next: ProductFilterState): void {
    this.filters = next;
    this.refetch();
  }

  private refetch(): void {
    this.loading = true;
    const orgId = this.orgContext.requireOrgId();
    this.fetchProducts$(orgId).subscribe({
      next: (products) => {
        this.products = products;
        this.loading = false;
      },
      error: () => (this.loading = false)
    });
  }

  private fetchProducts$(orgId: number) {
    return this.catalog.searchProducts(orgId, {
      q: this.query || undefined,
      limit: 40,
      brands: this.filters.brands,
      minPrice: this.filters.minPrice ?? undefined,
      maxPrice: this.filters.maxPrice ?? undefined,
      minDiscount: this.filters.minDiscount ?? undefined,
      sort: this.filters.sort
    });
  }
}
