import { CurrencyPipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { OrgContextService } from '../../../core/services/org-context.service';
import { OrdersService } from '../../../core/services/orders.service';
import { CartService } from '../../../core/services/cart.service';
import { ParentOrder } from '../../../core/models/order.model';
import { paymentDisplayLabel } from '../../../core/config/order-status';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';

@Component({
  selector: 'app-order-success',
  standalone: true,
  imports: [RouterLink, CurrencyPipe, SpinnerComponent],
  templateUrl: './order-success.component.html',
  styleUrl: './order-success.component.scss'
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

  get itemCount(): number {
    return this.order?.vendor_orders.reduce((sum, vo) => sum + vo.items.length, 0) ?? 0;
  }

  get paymentLabel(): string | null {
    return paymentDisplayLabel(this.order?.payment_method, this.order?.payment_status ?? null);
  }

  // The order detail page accepts both a parent checkout id and a single legacy order id
  // (order-detail.component.ts tries getParentOrderDetail first) -- this page's :orderId route
  // param is already the parent id, so the same value takes the buyer straight to that order's
  // own detail view instead of the generic order list.
  get viewOrderLink(): (string | number)[] {
    return this.order ? ['/o', this.orgCode, 'orders', this.order.id] : ['/o', this.orgCode, 'orders'];
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
