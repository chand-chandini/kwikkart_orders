import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { OrgContextService } from '../../../core/services/org-context.service';
import { CatalogService } from '../../../core/services/catalog.service';
import { AuthService } from '../../../core/services/auth.service';
import { Banner, Category, Product } from '../../../core/models/product.model';
import { ProductCardComponent } from '../../../shared/components/product-card/product-card.component';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { AppDownloadModalComponent } from '../../../shared/components/app-download-modal/app-download-modal.component';

interface CategorySection {
  key: string;
  departmentId: number | null;
  departmentName: string;
  categories: Category[];
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, ProductCardComponent, SpinnerComponent, EmptyStateComponent, AppDownloadModalComponent],
  templateUrl: './home.component.html'
})
export class HomeComponent implements OnInit {
  private readonly orgContext = inject(OrgContextService);
  private readonly catalog = inject(CatalogService);
  private readonly auth = inject(AuthService);

  loading = true;
  categoriesError = '';
  banners: Banner[] = [];
  categorySections: CategorySection[] = [];
  products: Product[] = [];
  showAppDownloadModal = false;
  private storeCategoriesLoaded = false;
  private storeCategories: Category[] = [];
  private catalogProducts: Product[] = [];
  private catalogProductsLoaded = false;
  private fallbackCategoriesRequested = false;

  get orgCode(): string {
    return this.orgContext.getCurrentCode() ?? '';
  }

  ngOnInit(): void {
    const orgId = this.orgContext.requireOrgId();
    this.catalog.listCategories(orgId).subscribe({
      next: (categories) => {
        this.storeCategoriesLoaded = true;
        this.storeCategories = categories;
        this.applyCategories(categories);
      },
      error: () => {
        this.storeCategoriesLoaded = true;
        this.tryLoadCategoryFallback();
      }
    });

    this.catalog.searchProducts(orgId, { limit: 50 }).subscribe({
      next: (products) => {
        this.catalogProducts = products;
        this.catalogProductsLoaded = true;
        this.products = products.slice(0, 16);
        if (this.storeCategoriesLoaded && !this.storeCategories.length) {
          this.tryLoadCategoryFallback();
        }
      },
      error: () => {
        this.catalogProductsLoaded = true;
        if (this.storeCategoriesLoaded && !this.storeCategories.length) {
          this.applyCategories([]);
        }
      }
    });

    this.catalog.listBanners(orgId).subscribe({
      next: (banners) => (this.banners = banners),
      error: () => (this.banners = [])
    });
    this.showAppDownloadModal = this.auth.consumeJustLoggedIn();
  }

  private applyCategories(categories: Category[]): void {
    const sections = new Map<string, CategorySection>();
    categories.forEach((category) => {
      const departmentId = category.department_id ?? null;
      const departmentName = category.department_name || 'Other';
      const key = departmentId === null ? `name:${departmentName}` : `id:${departmentId}`;
      let section = sections.get(key);
      if (!section) {
        section = { key, departmentId, departmentName, categories: [] };
        sections.set(key, section);
      }
      section.categories.push(category);
    });
    this.categorySections = Array.from(sections.values());
    this.categoriesError = '';
    this.loading = false;
  }

  // Some API deployments still return an empty org-scoped category list. Fall back to the
  // active taxonomy, but only show categories represented by this store's own products.
  private tryLoadCategoryFallback(): void {
    if (!this.catalogProductsLoaded) {
      return;
    }
    if (this.fallbackCategoriesRequested) {
      return;
    }
    this.fallbackCategoriesRequested = true;
    const productCategoryIds = new Set(this.catalogProducts.map((product) => product.category_id));
    if (!productCategoryIds.size) {
      this.applyCategories([]);
      return;
    }
    this.catalog.listCategories().subscribe({
      next: (categories) => this.applyCategories(categories.filter((category) => productCategoryIds.has(category.id))),
      error: () => {
        this.categoriesError = 'Could not load this store’s categories. Please refresh and try again.';
        this.loading = false;
      }
    });
  }
}
