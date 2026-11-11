import { Component, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterOutlet } from '@angular/router';
import { switchMap } from 'rxjs';

import { OrgContextService } from '../../core/services/org-context.service';
import { AuthService } from '../../core/services/auth.service';
import { CartService } from '../../core/services/cart.service';
import { SpinnerComponent } from '../../shared/components/spinner/spinner.component';
import { HeaderComponent } from '../../shared/components/header/header.component';
import { FooterComponent } from '../../shared/components/footer/footer.component';
import { FloatingCartBarComponent } from '../../shared/components/floating-cart-bar/floating-cart-bar.component';
import { OrgUnavailableComponent } from './org-unavailable.component';

@Component({
  selector: 'app-org-shell',
  standalone: true,
  imports: [RouterOutlet, SpinnerComponent, HeaderComponent, FooterComponent, FloatingCartBarComponent, OrgUnavailableComponent],
  template: `
    @if (orgContext.resolving()) {
      <app-spinner label="Loading store..." minHeight="100vh" />
    } @else if (orgContext.org()) {
      <div class="d-flex flex-column min-vh-100">
        <app-header [org]="orgContext.org()!" [orgCode]="code" />
        <main class="flex-grow-1">
          @if (auth.currentUser() && !storeAccessReady()) {
            @if (storeAccessError()) {
              <div class="container py-4">
                <div class="alert alert-warning mb-0" role="alert">{{ storeAccessError() }}</div>
              </div>
            } @else {
              <app-spinner label="Connecting to store..." />
            }
          } @else {
            <router-outlet />
          }
        </main>
        <app-footer [orgCode]="code" />
        <app-floating-cart-bar [orgCode]="code" />
      </div>
    } @else {
      <app-org-unavailable [reason]="orgContext.invalidReason()" />
    }
  `
})
export class OrgShellComponent {
  readonly orgContext = inject(OrgContextService);
  readonly auth = inject(AuthService);
  private readonly cart = inject(CartService);
  private readonly route = inject(ActivatedRoute);

  code = '';
  readonly storeAccessReady = signal(false);
  readonly storeAccessError = signal('');
  private joinedForOrgId: number | null = null;
  private joinedForUserId: number | null = null;

  constructor() {
    this.route.paramMap.pipe(switchMap((params) => {
      this.code = params.get('code') ?? '';
      this.storeAccessReady.set(false);
      this.storeAccessError.set('');
      return this.orgContext.resolve(this.code);
    })).subscribe();

    // Wait for customer membership before mounting routes whose catalog requests require it.
    effect(() => {
      const org = this.orgContext.org();
      const user = this.auth.currentUser();
      if (!org || !user) {
        return;
      }
      if (this.joinedForOrgId === org.id && this.joinedForUserId === user.id) {
        this.storeAccessReady.set(true);
        return;
      }
      this.joinedForOrgId = org.id;
      this.joinedForUserId = user.id;
      this.auth.redeemCode(this.code).subscribe({
        next: () => {
          this.storeAccessReady.set(true);
          this.cart.load(org.id).subscribe();
        },
        error: (error: { error?: { message?: string }; message?: string }) => {
          this.storeAccessError.set(
            error.error?.message || error.message || 'Could not connect to this store. Please try again.'
          );
        }
      });
    });
  }
}
