import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { switchMap } from 'rxjs';

import { OrgContextService } from '../../../core/services/org-context.service';
import { CatalogService } from '../../../core/services/catalog.service';
import { Product } from '../../../core/models/product.model';
import { ProductCardComponent } from '../../../shared/components/product-card/product-card.component';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [ProductCardComponent, SpinnerComponent, EmptyStateComponent],
  templateUrl: './search.component.html'
})
export class SearchComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly orgContext = inject(OrgContextService);
  private readonly catalog = inject(CatalogService);

  query = '';
  loading = true;
  products: Product[] = [];

  get orgCode(): string {
    return this.orgContext.getCurrentCode() ?? '';
  }

  ngOnInit(): void {
    this.route.queryParamMap.pipe(switchMap((params) => {
      this.query = params.get('q') ?? '';
      this.loading = true;
      const orgId = this.orgContext.requireOrgId();
      return this.catalog.searchProducts(orgId, { q: this.query || undefined, limit: 40 });
    })).subscribe({
      next: (products) => {
        this.products = products;
        this.loading = false;
      },
      error: () => (this.loading = false)
    });
  }
}
