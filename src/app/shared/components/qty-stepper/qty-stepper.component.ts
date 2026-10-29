import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-qty-stepper',
  standalone: true,
  template: `
    <div class="btn-group btn-group-sm flex-shrink-0" role="group" aria-label="Quantity">
      <button type="button" class="btn btn-outline-secondary" [disabled]="disabled || qty <= min" (click)="change(-1)">−</button>
      <button type="button" class="btn btn-outline-secondary disabled" style="min-width: 2.25rem;">{{ qty }}</button>
      <button type="button" class="btn btn-outline-secondary" [disabled]="disabled || qty >= max" (click)="change(1)">+</button>
    </div>
  `
})
export class QtyStepperComponent {
  @Input() qty = 1;
  @Input() min = 1;
  @Input() max = 99;
  @Input() disabled = false;
  @Output() qtyChange = new EventEmitter<number>();

  change(delta: number): void {
    const next = Math.min(this.max, Math.max(this.min, this.qty + delta));
    if (next !== this.qty) {
      this.qty = next;
      this.qtyChange.emit(next);
    }
  }
}
