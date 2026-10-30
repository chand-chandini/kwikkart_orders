import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { OrgContextService } from '../../../core/services/org-context.service';
import { OrdersService } from '../../../core/services/orders.service';
import { Order } from '../../../core/models/order.model';
import { ORDER_STATUS_BADGE, ORDER_STATUS_LABELS, paymentDisplayLabel } from '../../../core/config/order-status';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-order-list',
  standalone: true,
  imports: [RouterLink, CurrencyPipe, DatePipe, SpinnerComponent, EmptyStateComponent],
  templateUrl: './order-list.component.html'
})
export class OrderListComponent implements OnInit {
  private readonly orgContext = inject(OrgContextService);
  private readonly orders = inject(OrdersService);

  readonly statusLabels = ORDER_STATUS_LABELS;
  readonly statusBadge = ORDER_STATUS_BADGE;

  loading = true;
  list: Order[] = [];

  get orgCode(): string {
    return this.orgContext.getCurrentCode() ?? '';
  }

  ngOnInit(): void {
    this.orders.listMyOrders(this.orgContext.requireOrgId()).subscribe({
      next: (list) => {
        this.list = list;
        this.loading = false;
      },
      error: () => (this.loading = false)
    });
  }

  detailLink(order: Order): (string | number)[] {
    return ['/o', this.orgCode, 'orders', order.parent_order_id || order.id];
  }

  paymentLabel(order: Order): string | null {
    return paymentDisplayLabel(order.payment_method, order.payment_status);
  }
}
