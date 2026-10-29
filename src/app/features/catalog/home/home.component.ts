import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { OrgContextService } from '../../../core/services/org-context.service';
import { CatalogService } from '../../../core/services/catalog.service';
import { Banner, Category, Product } from '../../../core/models/product.model';
import { ProductCardComponent } from '../../../shared/components/product-card/product-card.component';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, ProductCardComponent, SpinnerComponent, EmptyStateComponent],
  templateUrl: './home.component.html'
})
export class HomeComponent implements OnInit {
  private readonly orgContext = inject(OrgContextService);
  private readonly catalog = inject(CatalogService);

  loading = true;
  banners: Banner[] = [];
  categories: Category[] = [];
  products: Product[] = [];

  get orgCode(): string {
    return this.orgContext.getCurrentCode() ?? '';
  }

  ngOnInit(): void {
    const orgId = this.orgContext.requireOrgId();
    forkJoin({
      banners: this.catalog.listBanners(orgId),
      categories: this.catalog.listCategories(orgId),
      products: this.catalog.searchProducts(orgId, { limit: 16 })
    }).subscribe({
      next: ({ banners, categories, products }) => {
        this.banners = banners;
        this.categories = categories;
        this.products = products;
        this.loading = false;
      },
      error: () => (this.loading = false)
    });
  }
}
