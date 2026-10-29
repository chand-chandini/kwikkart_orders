import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="d-flex flex-column align-items-center justify-content-center text-center py-5" style="min-height: 60vh;">
      <h1 class="display-6 fw-bold text-brand">404</h1>
      <p class="text-muted mb-4">We couldn't find that page.</p>
      <a routerLink="/" class="btn btn-brand px-4">Go home</a>
    </div>
  `
})
export class NotFoundComponent {}
