
import {
  Component,
  DestroyRef,
  EventEmitter,
  Input,
  Output,
  effect,
  inject
} from '@angular/core';

import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';

import {
  Router,
  RouterLink,
  RouterLinkActive
} from '@angular/router';

import {
  Subject,
  debounceTime,
  distinctUntilChanged
} from 'rxjs';

import { AuthService } from '../../../core/services/auth.service';
import { CartService } from '../../../core/services/cart.service';
import { CartCouponsService } from '../../../core/services/cart-coupons.service';
import { VendorDeliverySlotsService } from '../../../core/services/vendor-delivery-slots.service';
import { TryBuyCartService } from '../../../core/services/try-buy-cart.service';
import { CatalogService } from '../../../core/services/catalog.service';
import { OrgContextService } from '../../../core/services/org-context.service';

import { OrgSummary } from '../../../core/models/org.model';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, FormsModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent {
  @Input({ required: true }) org!: OrgSummary;
  @Input({ required: true }) orgCode!: string;

  @Output() searchSubmit = new EventEmitter<string>();

  private readonly destroyRef = inject(DestroyRef);

  readonly playStoreUrl =
    'https://play.google.com/store/apps/details?id=com.kwikkart.user&pcampaignid=web_share';

  searchTerm = '';
  sidebarOpen = false;

  categories: any[] = [];
  categoriesLoading = false;

  private readonly searchChange$ = new Subject<string>();

  private lastNavigatedQuery: string | null = null;
  private categoriesLoadedFor: string | null = null;

  constructor(
    public authService: AuthService,
    public cartService: CartService,
    public tryBuyCart: TryBuyCartService,
    private cartCoupons: CartCouponsService,
    private vendorSlots: VendorDeliverySlotsService,
    private catalogService: CatalogService,
    private orgContext: OrgContextService,
    private router: Router
  ) {
    // Load categories only after authentication.
    // This also detects successful login and logout automatically.
    effect(() => {
      const user = this.authService.currentUser();
      const org = this.orgContext.org();

      if (!user || !org || !this.authService.isAuthenticated()) {
        this.categories = [];
        this.categoriesLoading = false;
        this.categoriesLoadedFor = null;
        return;
      }

      const requestKey = `${org.id}:${user.id}`;

      if (this.categoriesLoadedFor === requestKey) {
        return;
      }

      this.loadCategories(requestKey);
    });

    // Search handling
    this.searchChange$
      .pipe(
        debounceTime(350),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(query => this.runSearch(query));
  }

  get brandName(): string {
    return this.org?.name || 'Our Store';
  }

  get brandInitial(): string {
    return this.brandName.charAt(0).toUpperCase();
  }

  loadCategories(requestKey?: string): void {
    // Never call the protected categories API without a login token.
    if (!this.authService.isAuthenticated() || !this.authService.currentUser()) {
      this.categories = [];
      this.categoriesLoading = false;
      return;
    }

    const orgId = this.orgContext.requireOrgId();

    const key = requestKey ??
      `${orgId}:${this.authService.currentUser()?.id}`;

    if (this.categoriesLoadedFor === key || this.categoriesLoading) {
      return;
    }

    this.categoriesLoadedFor = key;
    this.categoriesLoading = true;

    this.catalogService.listCategories(orgId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: categories => {
          this.categories = categories || [];
          this.categoriesLoading = false;
        },
        error: error => {
          console.error('Unable to load categories:', error);

          this.categories = [];
          this.categoriesLoading = false;

          // Allow another attempt if the request failed.
          this.categoriesLoadedFor = null;
        }
      });
  }

  onSearchInput(): void {
    this.searchChange$.next(this.searchTerm.trim());
  }

  onSearch(): void {
    const query = this.searchTerm.trim();

    this.searchSubmit.emit(query);
    this.runSearch(query);
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.searchChange$.next('');
    this.runSearch('');
  }

  private runSearch(query: string): void {
    if (this.lastNavigatedQuery === query) {
      return;
    }

    this.lastNavigatedQuery = query;

    if (query) {
      this.router.navigate(
        ['/o', this.orgCode, 'search'],
        { queryParams: { q: query } }
      );
    } else {
      this.router.navigate(['/o', this.orgCode]);
    }
  }

  closeSidebar(): void {
    this.sidebarOpen = false;
  }

  logout(): void {
    this.authService.logout();

    this.cartService.reset();
    this.cartCoupons.reset();
    this.vendorSlots.reset();
    this.tryBuyCart.reset();

    this.closeSidebar();

    this.router.navigate(['/']);
  }
}
