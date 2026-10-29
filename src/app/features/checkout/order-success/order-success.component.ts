import { CurrencyPipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { OrgContextService } from '../../../core/services/org-context.service';
import { OrdersService } from '../../../core/services/orders.service';
import { CartService } from '../../../core/services/cart.service';
import { ParentOrder } from '../../../core/models/order.model';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';

@Component({
  selector: 'app-order-success',
  standalone: true,
  imports: [RouterLink, CurrencyPipe, SpinnerComponent],
  templateUrl: './order-success.component.html'
})
export class OrderSuccessComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly orgContext = inject(OrgContextService);
  private readonly orders = inject(OrdersService);
  private readonly cart = inject(CartService);

  loading = true;
  order: ParentOrder | null = null;

  get orgCode(): string {
    return this.orgContext.getCurrentCode() ?? '';
  }

  ngOnInit(): void {
    const orderId = Number(this.route.snapshot.paramMap.get('orderId'));
    this.orders.getParentOrderDetail(orderId).subscribe({
      next: (order) => {
        this.order = order;
        this.loading = false;
      },
      error: () => (this.loading = false)
    });
    this.cart.reset();
  }
}
