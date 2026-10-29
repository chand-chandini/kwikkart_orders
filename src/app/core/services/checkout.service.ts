import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Address, AddressPayload } from '../models/address.model';
import { CouponResult, DeliverySlot, OrderCreateRequest, OrderCreateResponse } from '../models/order.model';

@Injectable({ providedIn: 'root' })
export class CheckoutService {
  constructor(private http: HttpClient) {}

  listAddresses(): Observable<Address[]> {
    return this.http
      .get<{ data: { addresses: Address[] } }>(`${environment.apiBaseUrl}/ecommerce/addresses`)
      .pipe(map((res) => res.data.addresses));
  }

  // The backend acks a create with just the new id (`{data:{id}}`) and an update with no body at
  // all (`{message:'updated'}`) — neither echoes back the stored row, so the Address the caller
  // gets here is reconstructed from what was actually submitted (which is exactly what got
  // persisted; validAddress() in the controller doesn't transform any field).
  createAddress(payload: AddressPayload): Observable<Address> {
    return this.http
      .post<{ data: { id: number } }>(`${environment.apiBaseUrl}/ecommerce/addresses`, payload)
      .pipe(map((res) => ({ id: res.data.id, ...payload })));
  }

  updateAddress(id: number, payload: AddressPayload): Observable<Address> {
    return this.http
      .put<{ message: string }>(`${environment.apiBaseUrl}/ecommerce/addresses/${id}`, payload)
      .pipe(map(() => ({ id, ...payload })));
  }

  deleteAddress(id: number): Observable<void> {
    return this.http.delete<void>(`${environment.apiBaseUrl}/ecommerce/addresses/${id}`);
  }

  listDeliverySlots(): Observable<DeliverySlot[]> {
    return this.http
      .get<{ data: { slots: DeliverySlot[] } }>(`${environment.apiBaseUrl}/ecommerce/delivery-slots`)
      .pipe(map((res) => res.data.slots));
  }

  validateCoupon(code: string, orderAmount: number): Observable<CouponResult> {
    return this.http
      .post<{ data: CouponResult }>(`${environment.apiBaseUrl}/ecommerce/coupons/validate`, {
        code,
        order_amount: orderAmount
      })
      .pipe(map((res) => res.data));
  }

  placeOrder(request: OrderCreateRequest): Observable<OrderCreateResponse> {
    return this.http
      .post<{ data: OrderCreateResponse }>(`${environment.apiBaseUrl}/ecommerce/orders`, request)
      .pipe(map((res) => res.data));
  }

  releaseUnpaidOrder(parentOrderId: number, final = false): Observable<void> {
    return this.http.post<void>(`${environment.apiBaseUrl}/ecommerce/parent-orders/${parentOrderId}/release`, { final });
  }
}
