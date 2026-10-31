import { Component, Input } from '@angular/core';

import { OrgResolveReason } from '../../core/models/org.model';
import { BRANDING } from '../../core/config/branding';

export const ORG_RESOLVE_MESSAGES: Record<OrgResolveReason, { title: string; body: string }> = {
  not_found: {
    title: 'Store not found',
    body: 'This storefront link is invalid or no longer exists. Double-check the link you were given.'
  },
  inactive: {
    title: 'Store unavailable',
    body: 'This store is not accepting orders right now. Please check back later.'
  },
  code_exhausted: {
    title: 'Link expired',
    body: 'This storefront link has reached its usage limit. Please ask the store for a fresh link.'
  },
  mart_disabled: {
    title: 'Ordering not enabled',
    body: 'Online ordering is not enabled for this store yet.'
  }
};

@Component({
  selector: 'app-org-unavailable',
  standalone: true,
  template: `
    <div class="d-flex flex-column align-items-center justify-content-center text-center px-3" style="min-height: 100vh;">
      <div class="mb-3 fs-1">🛒</div>
      <h2 class="fw-bold mb-2">{{ copy.title }}</h2>
      <p class="text-muted" style="max-width: 420px;">{{ copy.body }}</p>
      <img [src]="branding.logoUrl" [alt]="branding.appName" style="height: 28px; width: auto; object-fit: contain;" class="mt-4 opacity-75" />
    </div>
  `
})
export class OrgUnavailableComponent {
  @Input() set reason(value: OrgResolveReason | null) {
    this.copy = (value && ORG_RESOLVE_MESSAGES[value]) || ORG_RESOLVE_MESSAGES.not_found;
  }

  readonly branding = BRANDING;
  copy = ORG_RESOLVE_MESSAGES.not_found;
}
