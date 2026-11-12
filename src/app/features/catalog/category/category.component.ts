import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin, switchMap } from 'rxjs';

import { OrgContextService } from '../../../core/services/org-context.service';
import { CatalogService } from '../../../core/services/catalog.service';
import {
  Category,
  Product,
  ProductFilterFacets,
  ProductFilterState,
  ProductSort,
  Subcategory,
  activeFilterCount,
  emptyProductFilterState
} from '../../../core/models/product.model';
import { ProductCardComponent } from '../../../shared/components/product-card/product-card.component';
import { ProductSortBarComponent } from '../../../shared/components/product-sort-bar/product-sort-bar.component';
import { ProductFilterPanelComponent } from '../../../shared/components/product-filter-panel/product-filter-panel.component';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-category',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    ProductCardComponent,
    ProductSortBarComponent,
    ProductFilterPanelComponent,
    SpinnerComponent,
    EmptyStateComponent
  ],
  templateUrl: './category.component.html'
})
export class CategoryComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly orgContext = inject(OrgContextService);
  private readonly catalog = inject(CatalogService);
  private readonly router = inject(Router);

  loading = true;
  loadingMore = false;
  category: Category | null = null;
  categoryId = 0;
  subcategories: Subcategory[] = [];
  activeSubcategoryId: number | null = null;
  searchQuery = '';
  products: Product[] = [];
  page = 1;
  hasMore = true;
  private categoryDataReady = false;

  filters: ProductFilterState = emptyProductFilterState();
  facets: ProductFilterFacets | null = null;
  showFilters = false;

  get activeFilterCount(): number {
    return activeFilterCount(this.filters);
  }

  get orgCode(): string {
    return this.orgContext.getCurrentCode() ?? '';
  }

  // Below ~768px the filter panel becomes a fixed bottom-sheet (see .category-browse__filters--open
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
    this.route.paramMap.pipe(switchMap((params) => {
      this.categoryId = Number(params.get('categoryId'));
      this.categoryDataReady = false;
      this.page = 1;
      this.loading = true;
      this.filters = emptyProductFilterState(); // a new category is a fresh browsing context
      const orgId = this.orgContext.requireOrgId();
      return forkJoin({
        categories: this.catalog.listCategories(orgId),
        subcategories: this.catalog.listSubcategories(orgId, this.categoryId)
      });
    })).subscribe((subs) => {
      this.category = subs.categories.find((category) => category.id === this.categoryId) ?? null;
      this.subcategories = subs.subcategories;
      this.categoryDataReady = true;
      this.activeSubcategoryId = Number(this.route.snapshot.queryParamMap.get('sub')) || null;
      this.fetchProducts();
      this.fetchFacets();
    });

    this.route.queryParamMap.subscribe((params) => {
      if (!this.categoryDataReady) {
        return;
      }
      const selectedId = Number(params.get('sub')) || null;
      if (this.activeSubcategoryId !== selectedId) {
        this.activeSubcategoryId = selectedId;
        this.page = 1;
        this.loading = true;
        this.fetchProducts();
        this.fetchFacets();
      }
    });
  }

  selectSubcategory(id: number | null): void {
    if (this.activeSubcategoryId === id) {
      return;
    }
    this.activeSubcategoryId = id;
    this.page = 1;
    this.loading = true;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { sub: id },
      queryParamsHandling: 'merge'
    });
    this.fetchProducts();
    this.fetchFacets();
  }

  search(): void {
    const query = this.searchQuery.trim();
    if (query) {
      this.router.navigate(['/o', this.orgCode, 'search'], { queryParams: { q: query } });
    }
  }

  loadMore(): void {
    this.page += 1;
    this.loadingMore = true;
    this.fetchProducts(true);
  }

  onSortChange(sort: ProductSort): void {
    this.filters = { ...this.filters, sort };
    this.page = 1;
    this.loading = true;
    this.fetchProducts();
  }

  onFiltersChange(next: ProductFilterState): void {
    this.filters = next;
    this.page = 1;
    this.loading = true;
    this.fetchProducts();
  }

  // Scoped to category/subcategory only -- NOT re-fetched when brand/price/discount/sort change,
  // so the checkbox list stays put while the buyer is choosing from it (see
  // getProductFilterFacets' own comment in ecommerceModel.js).
  private fetchFacets(): void {
    const orgId = this.orgContext.requireOrgId();
    this.catalog
      .getProductFilters(orgId, { categoryId: this.categoryId, subcategoryId: this.activeSubcategoryId ?? undefined })
      .subscribe({ next: (facets) => (this.facets = facets), error: () => (this.facets = null) });
  }

  private fetchProducts(append = false): void {
    const orgId = this.orgContext.requireOrgId();
    this.catalog
      .searchProducts(orgId, {
        categoryId: this.categoryId,
        subcategoryId: this.activeSubcategoryId ?? undefined,
        page: this.page,
        limit: 20,
        brands: this.filters.brands,
        minPrice: this.filters.minPrice ?? undefined,
        maxPrice: this.filters.maxPrice ?? undefined,
        minDiscount: this.filters.minDiscount ?? undefined,
        sort: this.filters.sort
      })
      .subscribe({
        next: (products) => {
          this.products = append ? [...this.products, ...products] : products;
          this.hasMore = products.length === 20;
          this.loading = false;
          this.loadingMore = false;
        },
        error: () => {
          this.loading = false;
          this.loadingMore = false;
        }
      });
  }
}
