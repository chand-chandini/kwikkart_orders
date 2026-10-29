import { Component, Input } from '@angular/core';

import { BRANDING } from '../../../core/config/branding';

@Component({
  selector: 'app-auth-card',
  standalone: true,
  template: `
    <div class="auth-card-wrap d-flex align-items-center justify-content-center px-3">
      <div class="card auth-card shadow-sm border-0">
        <div class="card-body p-4 p-sm-5">
          <div class="text-center mb-4">
            <img [src]="branding.logoUrl" [alt]="branding.appName" class="auth-card__logo mb-3" />
            <h3 class="fw-bold mb-1">{{ title }}</h3>
            @if (subtitle) {
              <p class="text-muted mb-0">{{ subtitle }}</p>
            }
          </div>
          <ng-content></ng-content>
        </div>
      </div>
    </div>
  `,
  styleUrl: './auth-card.component.scss'
})
export class AuthCardComponent {
  @Input() title = '';
  @Input() subtitle = '';
  readonly branding = BRANDING;
}
