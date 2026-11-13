import { Component, EventEmitter, Input, Output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';

import { AuthService } from '../../../core/services/auth.service';
import { CartService } from '../../../core/services/cart.service';
import { CartCouponsService } from '../../../core/services/cart-coupons.service';
import { TryBuyCartService } from '../../../core/services/try-buy-cart.service';
import { OrgSummary } from '../../../core/models/org.model';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, FormsModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent {
  @Input({ required: true }) org!: OrgSummary;
  @Input({ required: true }) orgCode!: string;
  @Output() searchSubmit = new EventEmitter<string>();

  readonly playStoreUrl = 'https://play.google.com/store/apps/details?id=com.kwikkart.user&pcampaignid=web_share';

  searchTerm = '';
  sidebarOpen = false;

  // Live search: every keystroke feeds this, debounced so we're not navigating on every
  // character, and distinctUntilChanged so retyping the same term after a pause is a no-op. An
  // empty term navigates back to the shop home instead of leaving a stale result list on screen
  // with no way back.
  private readonly searchChange$ = new Subject<string>();

  constructor(
    public authService: AuthService,
    public cartService: CartService,
    public tryBuyCart: TryBuyCartService,
    private cartCoupons: CartCouponsService,
    private router: Router
  ) {
    this.searchChange$
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((term) => this.runSearch(term));
  }

  closeSidebar(): void {
    this.sidebarOpen = false;
  }

  onSearchInput(): void {
    this.searchChange$.next(this.searchTerm.trim());
  }

  onSearch(): void {
    this.runSearch(this.searchTerm.trim());
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.runSearch('');
  }

  private runSearch(q: string): void {
    if (q) {
      this.router.navigate(['/o', this.orgCode, 'search'], { queryParams: { q } });
    } else {
      this.router.navigate(['/o', this.orgCode]);
    }
  }

  // Goes straight to the sign-in screen rather than this org's home -- home is
  // authGuard-protected too, so navigating there post-logout would just bounce through it to
  // the same place a beat later, with an extra redirect flash in between.
  logout(): void {
    this.authService.logout();
    this.cartService.reset();
    this.cartCoupons.reset();
    this.tryBuyCart.reset();
    this.router.navigate(['/o', this.orgCode, 'auth', 'mobile']);
  }
}
