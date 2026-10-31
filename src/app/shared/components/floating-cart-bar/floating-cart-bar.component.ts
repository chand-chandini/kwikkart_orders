import { Component, Input, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map, startWith } from 'rxjs';

import { CartService } from '../../../core/services/cart.service';

// Fixed pill that mirrors the mobile app's bottom "N Items · View Cart" bar -- only shown once
// there's something in the cart, and suppressed on the cart/checkout pages themselves since the
// cart is already right there.
@Component({
  selector: 'app-floating-cart-bar',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './floating-cart-bar.component.html',
  styleUrl: './floating-cart-bar.component.scss'
})
export class FloatingCartBarComponent {
  @Input({ required: true }) orgCode!: string;

  readonly cartService = inject(CartService);
  private readonly router = inject(Router);

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map((e) => (e as NavigationEnd).urlAfterRedirects),
      startWith(this.router.url)
    ),
    { initialValue: this.router.url }
  );

  readonly visible = computed(() => {
    const url = this.currentUrl();
    const onCartOrCheckout = /\/(cart|checkout)(\/|$|\?)/.test(url);
    return !onCartOrCheckout && this.cartService.itemCount() > 0;
  });
}
