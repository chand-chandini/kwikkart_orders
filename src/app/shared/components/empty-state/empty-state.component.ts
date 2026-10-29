import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  template: `
    <div class="d-flex flex-column align-items-center justify-content-center text-center py-5">
      @if (icon) {
        <div class="fs-1 mb-2">{{ icon }}</div>
      }
      <h5 class="fw-semibold">{{ title }}</h5>
      @if (message) {
        <p class="text-muted mb-3">{{ message }}</p>
      }
      <ng-content></ng-content>
    </div>
  `
})
export class EmptyStateComponent {
  @Input() icon = '';
  @Input() title = 'Nothing here yet';
  @Input() message = '';
}
