import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin, switchMap } from 'rxjs';

import { OrgContextService } from '../../../core/services/org-context.service';
import { CatalogService } from '../../../core/services/catalog.service';
import { Category, Product, Subcategory } from '../../../core/models/product.model';
import { ProductCardComponent } from '../../../shared/components/product-card/product-card.component';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-category',
  standalone: true,
  imports: [FormsModule, RouterLink, ProductCardComponent, SpinnerComponent, EmptyStateComponent],
  templateUrl: './category.component.html'
})
export class CategoryComponent implements OnInit {
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

  get orgCode(): string {
    return this.orgContext.getCurrentCode() ?? '';
  }

  ngOnInit(): void {
    this.route.paramMap.pipe(switchMap((params) => {
      this.categoryId = Number(params.get('categoryId'));
      this.categoryDataReady = false;
      this.page = 1;
      this.loading = true;
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

  private fetchProducts(append = false): void {
    const orgId = this.orgContext.requireOrgId();
    this.catalog
      .searchProducts(orgId, {
        categoryId: this.categoryId,
        subcategoryId: this.activeSubcategoryId ?? undefined,
        page: this.page,
        limit: 20
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
