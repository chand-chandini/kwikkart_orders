import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { switchMap } from 'rxjs';

import { OrgContextService } from '../../../core/services/org-context.service';
import { CatalogService } from '../../../core/services/catalog.service';
import { Product, Subcategory } from '../../../core/models/product.model';
import { ProductCardComponent } from '../../../shared/components/product-card/product-card.component';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-category',
  standalone: true,
  imports: [ProductCardComponent, SpinnerComponent, EmptyStateComponent],
  templateUrl: './category.component.html'
})
export class CategoryComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly orgContext = inject(OrgContextService);
  private readonly catalog = inject(CatalogService);

  loading = true;
  loadingMore = false;
  categoryId = 0;
  subcategories: Subcategory[] = [];
  activeSubcategoryId: number | null = null;
  products: Product[] = [];
  page = 1;
  hasMore = true;

  get orgCode(): string {
    return this.orgContext.getCurrentCode() ?? '';
  }

  ngOnInit(): void {
    this.route.paramMap.pipe(switchMap((params) => {
      this.categoryId = Number(params.get('categoryId'));
      this.activeSubcategoryId = Number(this.route.snapshot.queryParamMap.get('sub')) || null;
      this.page = 1;
      this.loading = true;
      const orgId = this.orgContext.requireOrgId();
      return this.catalog.listSubcategories(orgId, this.categoryId);
    })).subscribe((subs) => {
      this.subcategories = subs;
      this.fetchProducts();
    });
  }

  selectSubcategory(id: number | null): void {
    if (this.activeSubcategoryId === id) {
      return;
    }
    this.activeSubcategoryId = id;
    this.page = 1;
    this.loading = true;
    this.fetchProducts();
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
