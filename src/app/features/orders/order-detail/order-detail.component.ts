import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { catchError, of } from 'rxjs';

import { OrgContextService } from '../../../core/services/org-context.service';
import { OrdersService } from '../../../core/services/orders.service';
import { OrderDetail, ParentOrder, ParentOrderVendorEntry } from '../../../core/models/order.model';
import { Address } from '../../../core/models/address.model';
import { dayLabel } from '../../../core/models/try-buy.model';
import { ORDER_STATUS_PILL, ORDER_STATUS_LABELS, paymentDisplayLabel } from '../../../core/config/order-status';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';

@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, SpinnerComponent],
  templateUrl: './order-detail.component.html',
  styleUrl: './order-detail.component.scss'
})
export class OrderDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly orgContext = inject(OrgContextService);
  private readonly orders = inject(OrdersService);

  readonly statusLabels = ORDER_STATUS_LABELS;
  readonly statusPill = ORDER_STATUS_PILL;

  loading = true;
  notFound = false;
  parentOrder: ParentOrder | null = null;
  singleOrder: OrderDetail | null = null;

  get orgCode(): string {
    return this.orgContext.getCurrentCode() ?? '';
  }

  // The page only ever renders this list — a parent checkout's vendor orders, or the single
  // legacy order (pre parent_order_id) wrapped in the same shape, so the template never needs to
  // branch between the two sources.
  get vendorGroups(): ParentOrderVendorEntry[] {
    if (this.parentOrder) {
      return this.parentOrder.vendor_orders;
    }
    if (this.singleOrder) {
      const o = this.singleOrder;
      return [
        {
          id: o.id,
          order_number: o.order_number,
          vendor_id: 0,
          vendor_name: o.vendor_name,
          status: o.status,
          items_total: o.items_total,
          discount_amount: o.discount_amount,
          seller_coupon_code: o.seller_coupon_code,
          seller_discount_amount: o.seller_discount_amount,
          delivery_charge: o.delivery_charge,
          grand_total: o.grand_total,
          items: o.items,
          payment_method: o.payment_method,
          payment_summary: o.payment_summary,
          placed_at: o.placed_at,
          delivery_slot: o.delivery_slot
        }
      ];
    }
    return [];
  }

  // All vendor orders under one checkout are inserted together, so the first one's placed_at IS
  // the checkout's placed time -- null only while still loading.
  get placedAt(): string | null {
    return this.vendorGroups[0]?.placed_at ?? null;
  }

  // "Thu, 27 Nov, 9:00 AM - 11:00 AM" -- null for Try & Buy orders and orders with no seller
  // slot booked, so the template can skip the row entirely.
  slotText(vo: ParentOrderVendorEntry): string {
    const s = vo.delivery_slot;
    if (!s || !s.slot_label) {
      return '';
    }
    return s.slot_date ? `${dayLabel(s.slot_date)}, ${s.slot_label}` : s.slot_label;
  }

  get orderNumber(): string {
    return this.parentOrder?.order_number ?? this.singleOrder?.order_number ?? '';
  }

  get address(): Address | null {
    return this.parentOrder?.address ?? this.singleOrder?.address ?? null;
  }

  get addressLine(): string {
    const a = this.address;
    if (!a) {
      return '';
    }
    const line = [a.house_no, a.address_line].filter(Boolean).join(' ');
    const landmark = a.landmark ? `, ${a.landmark}` : '';
    return `${line}${landmark}, ${a.city}, ${a.state} ${a.pincode}`;
  }

  get itemsTotal(): number {
    return this.parentOrder?.items_total ?? this.singleOrder?.items_total ?? 0;
  }

  get deliveryTotal(): number {
    return this.parentOrder?.delivery_charge ?? this.singleOrder?.delivery_charge ?? 0;
  }

  get grandTotal(): number {
    return this.parentOrder?.grand_total ?? this.singleOrder?.grand_total ?? 0;
  }

  get sellerDiscountTotal(): number {
    return this.parentOrder?.seller_discount_amount ?? this.singleOrder?.seller_discount_amount ?? 0;
  }

  // discount_amount is the COMBINED platform+seller discount (createOrder sums them before
  // storing it, same figure grand_total was computed from) -- subtracting the seller portion
  // back out is what isolates the platform coupon's own share, so showing this alongside
  // sellerDiscountTotal adds up to discount_amount rather than double-counting the seller part.
  get couponDiscount(): number {
    const combined = this.parentOrder?.discount_amount ?? this.singleOrder?.discount_amount ?? 0;
    return Math.round((combined - this.sellerDiscountTotal) * 100) / 100;
  }

  get couponCode(): string | null {
    return this.parentOrder?.coupon_code ?? this.singleOrder?.coupon_code ?? null;
  }

  private get paymentMethod(): string | undefined {
    return this.parentOrder?.payment_method ?? this.singleOrder?.payment_method;
  }

  get paymentLabel(): string | null {
    return paymentDisplayLabel(this.paymentMethod, this.parentOrder?.payment_status ?? null);
  }

  get isCod(): boolean {
    return this.paymentMethod === 'cod';
  }

  get payableOnDelivery(): number {
    return this.parentOrder?.payment_summary?.payable_on_delivery ?? this.singleOrder?.payment_summary?.payable_on_delivery ?? 0;
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
