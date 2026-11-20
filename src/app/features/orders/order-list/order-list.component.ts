import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { OrgContextService } from '../../../core/services/org-context.service';
import { OrdersService } from '../../../core/services/orders.service';
import { Order } from '../../../core/models/order.model';
import { dayLabel } from '../../../core/models/try-buy.model';
import { ORDER_STATUS_BADGE, ORDER_STATUS_LABELS, paymentDisplayLabel } from '../../../core/config/order-status';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { TryBuyRequestsComponent } from '../../try-buy/try-buy-requests/try-buy-requests.component';

export type OrdersTab = 'orders' | 'bookings';

@Component({
  selector: 'app-order-list',
  standalone: true,
  imports: [RouterLink, CurrencyPipe, DatePipe, SpinnerComponent, EmptyStateComponent, TryBuyRequestsComponent],
  templateUrl: './order-list.component.html'
})
export class OrderListComponent implements OnInit {
  private readonly orgContext = inject(OrgContextService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly orders = inject(OrdersService);

  readonly statusLabels = ORDER_STATUS_LABELS;
  readonly statusBadge = ORDER_STATUS_BADGE;

  loading = true;
  list: Order[] = [];

  // Orders and Try & Buy bookings are shown as a switch on one page rather than separate routes
  // -- preselectable via ?tab=bookings, read reactively so switching tabs doesn't need a reload.
  tab: OrdersTab = 'orders';

  get orgCode(): string {
    return this.orgContext.getCurrentCode() ?? '';
  }

  setTab(tab: OrdersTab): void {
    this.tab = tab;
    this.router.navigate([], { relativeTo: this.route, queryParams: { tab }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      this.tab = params.get('tab') === 'bookings' ? 'bookings' : 'orders';
    });
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

  // "Thu, 27 Nov, 9:00 AM - 11:00 AM" -- a quick "will deliver on this date/time" reference.
  // Blank when no vendor booked a slot (Try & Buy, old orders), or vendors booked different
  // slots (a multi-seller checkout) -- the order detail page breaks those down per seller.
  slotText(order: Order): string {
    const withSlot = order.vendors.filter((v) => v.delivery_slot?.slot_label);
    if (!withSlot.length) {
      return '';
    }
    const first = withSlot[0].delivery_slot!;
    const sameForAll = withSlot.every(
      (v) => v.delivery_slot!.slot_label === first.slot_label && v.delivery_slot!.slot_date === first.slot_date
    );
    if (!sameForAll) {
      return '';
    }
    return first.slot_date ? `${dayLabel(first.slot_date)}, ${first.slot_label}` : first.slot_label!;
  }
}
