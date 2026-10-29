import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Order, OrderDetail, ParentOrder } from '../models/order.model';

@Injectable({ providedIn: 'root' })
export class OrdersService {
  constructor(private http: HttpClient) {}

  listMyOrders(orgId?: number): Observable<Order[]> {
    const params = orgId ? new HttpParams().set('org_id', orgId) : undefined;
    return this.http
      .get<{ data: { orders: Order[] } }>(`${environment.apiBaseUrl}/ecommerce/orders`, { params })
      .pipe(map((res) => res.data.orders));
  }

  getOrderDetail(orderId: number): Observable<OrderDetail> {
    return this.http
      .get<{ data: { order: OrderDetail } }>(`${environment.apiBaseUrl}/ecommerce/orders/${orderId}`)
      .pipe(map((res) => res.data.order));
  }

  getParentOrderDetail(parentOrderId: number): Observable<ParentOrder> {
    return this.http
      .get<{ data: { order: ParentOrder } }>(`${environment.apiBaseUrl}/ecommerce/parent-orders/${parentOrderId}`)
      .pipe(map((res) => res.data.order));
  }

  invoiceUrl(orderId: number): string {
    return `${environment.apiBaseUrl}/ecommerce/orders/${orderId}/invoice`;
  }

  parentInvoiceUrl(parentOrderId: number): string {
    return `${environment.apiBaseUrl}/ecommerce/parent-orders/${parentOrderId}/invoice`;
  }
}
