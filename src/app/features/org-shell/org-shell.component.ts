import { Component, effect, inject } from '@angular/core';
import { ActivatedRoute, RouterOutlet } from '@angular/router';
import { switchMap } from 'rxjs';

import { OrgContextService } from '../../core/services/org-context.service';
import { AuthService } from '../../core/services/auth.service';
import { CartService } from '../../core/services/cart.service';
import { SpinnerComponent } from '../../shared/components/spinner/spinner.component';
import { HeaderComponent } from '../../shared/components/header/header.component';
import { FooterComponent } from '../../shared/components/footer/footer.component';
import { OrgUnavailableComponent } from './org-unavailable.component';

@Component({
  selector: 'app-org-shell',
  standalone: true,
  imports: [RouterOutlet, SpinnerComponent, HeaderComponent, FooterComponent, OrgUnavailableComponent],
  template: `
    @if (orgContext.resolving()) {
      <app-spinner label="Loading store..." minHeight="100vh" />
    } @else if (orgContext.org()) {
      <div class="d-flex flex-column min-vh-100">
        <app-header [org]="orgContext.org()!" [orgCode]="code" />
        <main class="flex-grow-1">
          <router-outlet />
        </main>
        <app-footer [orgCode]="code" />
      </div>
    } @else {
      <app-org-unavailable [reason]="orgContext.invalidReason()" />
    }
  `
})
export class OrgShellComponent {
  readonly orgContext = inject(OrgContextService);
  private readonly auth = inject(AuthService);
  private readonly cart = inject(CartService);
  private readonly route = inject(ActivatedRoute);

  code = '';
  private joinedForOrgId: number | null = null;

  constructor() {
    this.route.paramMap.pipe(switchMap((params) => {
      this.code = params.get('code') ?? '';
      return this.orgContext.resolve(this.code);
    })).subscribe();

    // Once the org resolves and the customer is signed in, redeem the same code as org
    // membership so canShopOrg-gated catalog/cart/order calls succeed. Idempotent on the
    // backend (already_member short-circuits), guarded here to run once per org/session.
    effect(() => {
      const org = this.orgContext.org();
      const user = this.auth.currentUser();
      if (!org || !user || this.joinedForOrgId === org.id) {
        return;
      }
      this.joinedForOrgId = org.id;
      this.auth.redeemCode(this.code).subscribe({
        next: () => this.cart.load(org.id).subscribe(),
        error: () => {
          // role_mismatch / exhausted codes still let the customer browse; cart/checkout calls
          // will surface the real backend error if they truly can't shop here.
        }
      });
    });
  }
}
