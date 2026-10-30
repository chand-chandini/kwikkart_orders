import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { OrgContextService } from '../../../core/services/org-context.service';
import { CatalogService } from '../../../core/services/catalog.service';
import { Banner, Category, Product, Subcategory } from '../../../core/models/product.model';
import { ProductCardComponent } from '../../../shared/components/product-card/product-card.component';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';

interface SubcategoryTile {
  sub: Subcategory;
  color: string;
}

interface CategorySection {
  category: Category;
  subcategories: SubcategoryTile[];
}

// Pastel fallbacks for subcategories with no admin-set tint_color -- cycled across the whole
// page (not reset per category) so tiles read as varied, like the reference design, rather than
// a single flat grey everywhere.
const TILE_PALETTE = ['#dcecd9', '#dceaf6', '#faeccb', '#e6e1f5', '#fbe0df', '#d9f0ea'];

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
  categorySections: CategorySection[] = [];
  products: Product[] = [];

  get orgCode(): string {
    return this.orgContext.getCurrentCode() ?? '';
  }

  ngOnInit(): void {
    const orgId = this.orgContext.requireOrgId();
    forkJoin({
      banners: this.catalog.listBanners(orgId),
      categories: this.catalog.listCategories(orgId),
      subcategories: this.catalog.listSubcategories(orgId),
      products: this.catalog.searchProducts(orgId, { limit: 16 })
    }).subscribe({
      next: ({ banners, categories, subcategories, products }) => {
        this.banners = banners;
        let colorCursor = 0;
        this.categorySections = categories.map((category) => ({
          category,
          subcategories: subcategories
            .filter((sub) => sub.category_id === category.id)
            .map((sub) => ({ sub, color: sub.tint_color || TILE_PALETTE[colorCursor++ % TILE_PALETTE.length] }))
        }));
        this.products = products;
        this.loading = false;
      },
      error: () => (this.loading = false)
    });
  }
}
