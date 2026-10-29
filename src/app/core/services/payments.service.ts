import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ConfirmPaymentPayload, RazorpayCheckoutOptions } from '../models/payment.model';

declare global {
  interface Window {
    Razorpay: new (options: RazorpayCheckoutOptions) => { open: () => void };
  }
}

const RAZORPAY_SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js';

@Injectable({ providedIn: 'root' })
export class PaymentsService {
  private scriptLoaded: Promise<void> | null = null;

  constructor(private http: HttpClient) {}

  loadCheckoutScript(): Promise<void> {
    if (this.scriptLoaded) {
      return this.scriptLoaded;
    }
    this.scriptLoaded = new Promise((resolve, reject) => {
      if (window.Razorpay) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = RAZORPAY_SCRIPT_URL;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('failed to load payment gateway'));
      document.body.appendChild(script);
    });
    return this.scriptLoaded;
  }

  async openCheckout(options: RazorpayCheckoutOptions): Promise<void> {
    await this.loadCheckoutScript();
    new window.Razorpay(options).open();
  }

  confirm(payload: ConfirmPaymentPayload): Observable<unknown> {
    return this.http
      .post<{ data: unknown }>(`${environment.apiBaseUrl}/payments/confirm`, {
        gateway_order_id: payload.gateway_order_id,
        gateway_payment_id: payload.gateway_payment_id,
        signature: payload.signature
      })
      .pipe(map((res) => res.data));
  }

  reconcile(): Observable<{ recovered: number }> {
    return this.http
      .post<{ data: { recovered: number } }>(`${environment.apiBaseUrl}/payments/reconcile`, {})
      .pipe(map((res) => res.data));
  }
}
