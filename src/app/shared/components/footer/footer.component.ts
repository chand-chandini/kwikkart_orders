import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { BRANDING } from '../../../core/config/branding';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterLink],
  template: `
    <footer class="bg-white border-top mt-5 py-4">
      <div class="container d-flex flex-column flex-sm-row justify-content-between align-items-center gap-2 small text-muted">
        <div class="d-flex align-items-center gap-2">
          <img [src]="branding.logoUrl" [alt]="branding.appName" style="height: 18px; width: auto; object-fit: contain;" />
          <span>&copy; {{ year }} {{ branding.appName }}. All rights reserved.</span>
        </div>
        <div class="d-flex gap-3">
          <a [routerLink]="['/o', orgCode, 'orders']" class="text-muted text-decoration-none">Orders</a>
          <a [routerLink]="['/o', orgCode]" class="text-muted text-decoration-none">Home</a>
        </div>
      </div>
    </footer>
  `
})
export class FooterComponent {
  @Input({ required: true }) orgCode!: string;
  readonly branding = BRANDING;
  readonly year = new Date().getFullYear();
}
