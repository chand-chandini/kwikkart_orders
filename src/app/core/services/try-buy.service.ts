import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { CreateTryBuyRequestBody, TryBuyQuote, TryBuyQuoteItem, TryBuyRequest, TryBuyShareResult, TryBuySlotsResponse } from '../models/try-buy.model';

// Try & Buy API (kkapi public_app/controllers/tryBuyCtrl.js). Separate from CartService/
// CheckoutService -- nothing here touches the cart, coupons or payments.
@Injectable({ providedIn: 'root' })
export class TryBuyService {
  constructor(private http: HttpClient) {}

  quote(items: TryBuyQuoteItem[], addressId?: number | null): Observable<TryBuyQuote> {
    return this.http
      .post<{ data: TryBuyQuote }>(`${environment.apiBaseUrl}/ecommerce/try-buy/quote`, {
        items,
        ...(addressId ? { address_id: addressId } : {})
      })
      .pipe(map((res) => res.data));
  }

  createRequest(body: CreateTryBuyRequestBody): Observable<{ request_ids: number[]; quote: TryBuyQuote }> {
    return this.http
      .post<{ data: { request_ids: number[]; quote: TryBuyQuote } }>(`${environment.apiBaseUrl}/ecommerce/try-buy/requests`, body)
      .pipe(map((res) => res.data));
  }

  listRequests(): Observable<TryBuyRequest[]> {
    return this.http
      .get<{ data: { requests: TryBuyRequest[] } }>(`${environment.apiBaseUrl}/ecommerce/try-buy/requests`)
      .pipe(map((res) => res.data.requests));
  }

  cancelRequest(id: number): Observable<void> {
    return this.http.post<void>(`${environment.apiBaseUrl}/ecommerce/try-buy/requests/${id}/cancel`, {});
  }

  vendorSlots(vendorId: number): Observable<TryBuySlotsResponse> {
    return this.http
      .get<{ data: TryBuySlotsResponse }>(`${environment.apiBaseUrl}/ecommerce/try-buy/slots`, { params: { vendor_id: vendorId } })
      .pipe(map((res) => res.data));
  }

  // Shared Try & Buy (kkapi tryBuyShareCtrl.create) -- opens or refreshes a shareable booking for
  // these items (one seller only). Passing request_id links the share to an already-placed
  // booking (shareTryBuyOrder's flow) instead of the pre-booking cart's own share.
  createShare(items: TryBuyQuoteItem[], requestId?: number): Observable<TryBuyShareResult> {
    return this.http
      .post<{ data: TryBuyShareResult }>(`${environment.apiBaseUrl}/ecommerce/try-buy/shares`, {
        items,
        ...(requestId ? { request_id: requestId } : {})
      })
      .pipe(map((res) => res.data));
  }
}
