import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-spinner',
  standalone: true,
  template: `
    <div class="d-flex flex-column align-items-center justify-content-center text-center" [style.minHeight]="minHeight">
      <div class="spinner-border text-brand" role="status"></div>
      @if (label) {
        <div class="small text-muted mt-2">{{ label }}</div>
      }
    </div>
  `
})
export class SpinnerComponent {
  @Input() label = '';
  @Input() minHeight = '40vh';
}
