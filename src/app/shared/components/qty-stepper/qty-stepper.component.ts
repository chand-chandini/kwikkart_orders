import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-qty-stepper',
  standalone: true,
  template: `
    <div class="qty-pill" [class.qty-pill--disabled]="disabled" [class.qty-pill--compact]="compact">
      <button type="button" class="qty-pill__btn" [disabled]="disabled || qty <= min" (click)="change(-1)" aria-label="Decrease quantity">−</button>
      <span class="qty-pill__value">{{ qty }}</span>
      <button type="button" class="qty-pill__btn" [disabled]="disabled || qty >= max" (click)="change(1)" aria-label="Increase quantity">+</button>
    </div>
  `,
  styles: [`
    // A single filled brand-color pill (no internal borders to misalign) instead of a Bootstrap
    // btn-group -- also makes the quantity itself bold white-on-brand rather than a muted
    // disabled-looking button. 44px tall everywhere so it lines up with the full-size "Add to
    // cart" button it always sits next to.
    .qty-pill {
      display: inline-flex;
      align-items: center;
      height: 44px;
      background: var(--kk-brand-primary);
      border-radius: 999px;
      overflow: hidden;
      flex-shrink: 0;
    }

    .qty-pill--disabled {
      opacity: 0.6;
    }

    // Matches Bootstrap's btn-sm height (~31px) for spots like the product card where the
    // stepper sits in place of a btn-sm "Add to cart" button -- the default 44px pill made the
    // +/- buttons noticeably taller than that button, reading as extra top/bottom padding.
    .qty-pill--compact {
      height: 31px;
    }

    .qty-pill--compact .qty-pill__btn {
      width: 1.9rem;
      font-size: 0.95rem;
    }

    .qty-pill--compact .qty-pill__value {
      min-width: 1.5rem;
      font-size: 0.85rem;
    }

    .qty-pill__btn {
      width: 2.5rem;
      height: 100%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: none;
      background: transparent;
      color: #fff;
      font-size: 1.1rem;
      font-weight: 700;
      line-height: 1;
      padding: 0;
      cursor: pointer;
    }

    .qty-pill__btn:hover:not(:disabled), .qty-pill__btn:focus-visible:not(:disabled) {
      background: rgba(255, 255, 255, 0.18);
    }

    .qty-pill__btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .qty-pill__value {
      min-width: 1.9rem;
      text-align: center;
      color: #fff;
      font-weight: 700;
      font-size: 1rem;
    }
  `]
})
export class QtyStepperComponent {
  @Input() qty = 1;
  @Input() min = 1;
  @Input() max = 99;
  @Input() disabled = false;
  @Input() compact = false;
  @Output() qtyChange = new EventEmitter<number>();

  change(delta: number): void {
    const next = Math.min(this.max, Math.max(this.min, this.qty + delta));
    if (next !== this.qty) {
      this.qty = next;
      this.qtyChange.emit(next);
    }
  }
}
