import { HttpClient } from '@angular/common/http';
import { Injectable, computed, signal } from '@angular/core';
import { Observable, map, switchMap, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AddToCartPayload, CartState } from '../models/cart.model';

const EMPTY_CART: CartState = {
  items: [],
  items_total: 0,
  vendors: [],
  delivery_total: 0,
  grand_total: 0,
  address_location_missing: false
};

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly state = signal<CartState>(EMPTY_CART);
  readonly cart = this.state.asReadonly();
  readonly itemCount = computed(() => this.state().items.length);

  constructor(private http: HttpClient) {}

  load(orgId: number, addressId?: number): Observable<CartState> {
    let url = `${environment.apiBaseUrl}/ecommerce/cart?org_id=${orgId}`;
    if (addressId) {
      url += `&address_id=${addressId}`;
    }
    return this.http.get<{ data: CartState }>(url).pipe(
      map((res) => res.data),
      tap((cart) => this.state.set(cart))
    );
  }

  // The mutation endpoints below (add/update/remove/clear) only ack with {status, message} — they
  // never return the resulting cart, unlike GET /ecommerce/cart. Re-fetching after each one is
  // what actually keeps `state` (and everything bound to it: header badge, cart page, totals) in
  // sync; treating their response as the new cart left `state` as `undefined` and crashed the
  // cart page's template on the next render, which froze whatever button had just been clicked.
  addToCart(orgId: number, payload: AddToCartPayload): Observable<CartState> {
    return this.http
      .post<{ message: string }>(`${environment.apiBaseUrl}/ecommerce/cart`, { ...payload, org_id: orgId })
      .pipe(switchMap(() => this.load(orgId)));
  }

  updateQty(orgId: number, itemId: number, qty: number): Observable<CartState> {
    return this.http
      .put<{ message: string }>(`${environment.apiBaseUrl}/ecommerce/cart/${itemId}`, { qty, org_id: orgId })
      .pipe(switchMap(() => this.load(orgId)));
  }

  removeItem(orgId: number, itemId: number): Observable<CartState> {
    return this.http
      .delete<{ message: string }>(`${environment.apiBaseUrl}/ecommerce/cart/${itemId}?org_id=${orgId}`)
      .pipe(switchMap(() => this.load(orgId)));
  }

  clear(orgId: number): Observable<CartState> {
    return this.http
      .delete<{ message: string }>(`${environment.apiBaseUrl}/ecommerce/cart?org_id=${orgId}`)
      .pipe(switchMap(() => this.load(orgId)));
  }

  reset(): void {
    this.state.set(EMPTY_CART);
  }
}
