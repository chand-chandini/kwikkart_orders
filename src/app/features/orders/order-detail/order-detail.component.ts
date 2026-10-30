import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { catchError, of } from 'rxjs';

import { OrgContextService } from '../../../core/services/org-context.service';
import { OrdersService } from '../../../core/services/orders.service';
import { OrderDetail, ParentOrder, ParentOrderVendorEntry } from '../../../core/models/order.model';
import { ORDER_STATUS_BADGE, ORDER_STATUS_LABELS, paymentDisplayLabel } from '../../../core/config/order-status';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';

@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, SpinnerComponent],
  templateUrl: './order-detail.component.html'
})
export class OrderDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly orgContext = inject(OrgContextService);
  private readonly orders = inject(OrdersService);

  readonly statusLabels = ORDER_STATUS_LABELS;
  readonly statusBadge = ORDER_STATUS_BADGE;

  loading = true;
  notFound = false;
  parentOrder: ParentOrder | null = null;
  singleOrder: OrderDetail | null = null;

  get orgCode(): string {
    return this.orgContext.getCurrentCode() ?? '';
  }

  get vendorEntries(): ParentOrderVendorEntry[] {
    return this.parentOrder?.vendor_orders ?? [];
  }

  get paymentLabel(): string | null {
    return paymentDisplayLabel(this.parentOrder?.payment_method, this.parentOrder?.payment_status);
  }

  ngOnInit(): void {
    const orderId = Number(this.route.snapshot.paramMap.get('orderId'));
    this.orders
      .getParentOrderDetail(orderId)
      .pipe(catchError(() => of(null)))
      .subscribe((parent) => {
        if (parent) {
          this.parentOrder = parent;
          this.loading = false;
          return;
        }
        this.orders
          .getOrderDetail(orderId)
          .pipe(catchError(() => of(null)))
          .subscribe((single) => {
            this.singleOrder = single;
            this.notFound = !single;
            this.loading = false;
          });
      });
  }
}
