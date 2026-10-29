import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { BRANDING } from '../../core/config/branding';

// Root '/' route. Production traffic always arrives via /o/{code}; this page exists so a bare
// domain hit (or local dev) doesn't 404, and so testers can jump into any org code by hand.
@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="d-flex flex-column align-items-center justify-content-center text-center px-3" style="min-height: 100vh;">
      <img [src]="branding.logoUrl" [alt]="branding.appName" style="height: 56px; width: auto; max-width: 260px; object-fit: contain;" class="mb-3" />
      <p class="text-muted mb-4" style="max-width: 420px;">
        Enter your store's organisation code to start shopping, or use the link shared by your store.
      </p>
      <form class="d-flex gap-2" (ngSubmit)="go()">
        <input class="form-control" placeholder="Organisation code" [(ngModel)]="code" name="code" style="max-width: 260px;" />
        <button class="btn btn-brand" type="submit">Go</button>
      </form>
    </div>
  `
})
export class LandingComponent {
  readonly branding = BRANDING;
  code = '';

  constructor(private router: Router) {}

  go(): void {
    const trimmed = this.code.trim();
    if (trimmed) {
      this.router.navigate(['/o', trimmed]);
    }
  }
}
