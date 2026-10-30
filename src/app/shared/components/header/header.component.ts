import { Location } from '@angular/common';
import { Component, EventEmitter, Input, OnDestroy, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';

import { AuthService } from '../../../core/services/auth.service';
import { CartService } from '../../../core/services/cart.service';
import { OrgSummary } from '../../../core/models/org.model';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, FormsModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent implements OnDestroy {
  @Input({ required: true }) org!: OrgSummary;
  @Input({ required: true }) orgCode!: string;
  @Output() searchSubmit = new EventEmitter<string>();

  searchTerm = '';

  // Header persists across route changes (it lives outside the <router-outlet>), so this
  // counts every in-app navigation since the shell loaded. Landing directly on a deep link
  // (refresh, shared URL) means there's nothing to go "back" to inside the app, so the back
  // button falls through to Home instead of leaving the site via browser history.
  private navCount = 0;
  private readonly navSub: Subscription;

  constructor(
    public authService: AuthService,
    public cartService: CartService,
    private router: Router,
    private location: Location
  ) {
    this.navSub = this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.navCount++;
      }
    });
  }

  ngOnDestroy(): void {
    this.navSub.unsubscribe();
  }

  goBack(): void {
    if (this.navCount > 1) {
      this.location.back();
    } else {
      this.router.navigate(['/o', this.orgCode]);
    }
  }

  onSearch(): void {
    const q = this.searchTerm.trim();
    if (!q) {
      return;
    }
    this.router.navigate(['/o', this.orgCode, 'search'], { queryParams: { q } });
  }

  logout(): void {
    this.authService.logout();
    this.cartService.reset();
    this.router.navigate(['/o', this.orgCode]);
  }
}
