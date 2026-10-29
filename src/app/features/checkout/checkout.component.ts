import { CurrencyPipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { OrgContextService } from '../../core/services/org-context.service';
import { CartService } from '../../core/services/cart.service';
import { CheckoutService } from '../../core/services/checkout.service';
import { PaymentsService } from '../../core/services/payments.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { Address, AddressPayload } from '../../core/models/address.model';
import { DeliverySlot, PaymentMethod } from '../../core/models/order.model';
import { SpinnerComponent } from '../../shared/components/spinner/spinner.component';

const EMPTY_ADDRESS: AddressPayload = {
  contact_name: '',
  contact_phone: '',
  address_line: '',
  city: '',
  state: '',
  pincode: '',
  house_no: null,
  landmark: null,
  label: 'Home',
  latitude: null,
  longitude: null,
  is_default: false
};

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [FormsModule, CurrencyPipe, SpinnerComponent],
  templateUrl: './checkout.component.html'
})
export class CheckoutComponent implements OnInit {
  private readonly orgContext = inject(OrgContextService);
  readonly cartService = inject(CartService);
  private readonly checkout = inject(CheckoutService);
  private readonly payments = inject(PaymentsService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  loading = true;
  placing = false;
  addresses: Address[] = [];
  selectedAddressId: number | null = null;
  slots: DeliverySlot[] = [];
  selectedSlotId: number | null = null;
  paymentMethod: PaymentMethod = 'cod';
  couponCode = '';
  couponDiscount = 0;
  instructions = '';

  showAddressForm = false;
  newAddress: AddressPayload = { ...EMPTY_ADDRESS };
  locating = false;

  get orgCode(): string {
    return this.orgContext.getCurrentCode() ?? '';
  }

  get codEnabled(): boolean {
    return !!this.orgContext.accessFlags()?.cod_enabled;
  }

  get onlineEnabled(): boolean {
    return !!this.orgContext.accessFlags()?.online_payment_enabled;
  }

  ngOnInit(): void {
    const orgId = this.orgContext.requireOrgId();
    this.checkout.listAddresses().subscribe((addresses) => {
      this.addresses = addresses;
      const def = addresses.find((a) => a.is_default) ?? addresses[0];
      if (def) {
        this.selectAddress(def.id);
      } else {
        this.showAddressForm = true;
      }
    });
    this.checkout.listDeliverySlots().subscribe((slots) => (this.slots = slots));
    this.cartService.load(orgId).subscribe({
      next: () => (this.loading = false),
      error: () => (this.loading = false)
    });
    if (!this.codEnabled && this.onlineEnabled) {
      this.paymentMethod = 'online';
    }
  }

  selectAddress(id: number): void {
    this.selectedAddressId = id;
    this.cartService.load(this.orgContext.requireOrgId(), id).subscribe();
  }

  useMyLocation(): void {
    if (!navigator.geolocation) {
      this.toast.error('Location is not available on this browser.');
      return;
    }
    this.locating = true;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.newAddress.latitude = pos.coords.latitude;
        this.newAddress.longitude = pos.coords.longitude;
        this.locating = false;
      },
      () => {
        this.locating = false;
        this.toast.error('Could not get your location. You can still save the address without it.');
      }
    );
  }

  saveAddress(): void {
    this.checkout.createAddress(this.newAddress).subscribe((address) => {
      this.addresses = [...this.addresses, address];
      this.newAddress = { ...EMPTY_ADDRESS };
      this.showAddressForm = false;
      this.selectAddress(address.id);
    });
  }

  applyCoupon(): void {
    if (!this.couponCode.trim()) {
      return;
    }
    this.checkout.validateCoupon(this.couponCode.trim(), this.cartService.cart().items_total).subscribe({
      next: (result) => {
        this.couponDiscount = result.discount_amount;
        this.toast.success(`Coupon applied: -${result.discount_amount}`);
      },
      error: () => (this.couponDiscount = 0)
    });
  }

  placeOrder(): void {
    if (!this.selectedAddressId) {
      this.toast.error('Please select or add a delivery address.');
      return;
    }
    this.placing = true;
    this.checkout
      .placeOrder({
        address_id: this.selectedAddressId,
        payment_method: this.paymentMethod,
        delivery_slot_id: this.selectedSlotId ?? undefined,
        org_id: this.orgContext.requireOrgId(),
        coupon_code: this.couponCode.trim() || undefined,
        instructions: this.instructions.trim() || undefined
      })
      .subscribe({
        next: (result) => {
          if (this.paymentMethod === 'cod' || result.paid_by_wallet) {
            this.placing = false;
            this.router.navigate(['/o', this.orgCode, 'checkout', 'success', result.parent_order_id]);
            return;
          }
          this.payOnline(result);
        },
        error: () => (this.placing = false)
      });
  }

  private payOnline(result: { parent_order_id: number; rzp_order_id?: string; key_id?: string; amount?: number }): void {
    const user = this.auth.currentUser();
    this.payments
      .openCheckout({
        key: result.key_id || '',
        order_id: result.rzp_order_id || '',
        amount: Math.round((result.amount || 0) * 100),
        name: 'Kwikkart',
        description: `Order #${result.parent_order_id}`,
        prefill: { name: user?.name || undefined, contact: user?.mobile, email: user?.email || undefined },
        theme: { color: '#1a7f3c' },
        handler: (response) => {
          this.payments
            .confirm({
              gateway_order_id: response.razorpay_order_id,
              gateway_payment_id: response.razorpay_payment_id,
              signature: response.razorpay_signature
            })
            .subscribe({
              next: () => {
                this.placing = false;
                this.router.navigate(['/o', this.orgCode, 'checkout', 'success', result.parent_order_id]);
              },
              error: () => {
                this.placing = false;
                this.toast.error('We could not confirm your payment automatically. Check Orders in a moment.');
              }
            });
        },
        modal: {
          ondismiss: () => {
            this.placing = false;
            this.checkout.releaseUnpaidOrder(result.parent_order_id).subscribe();
            this.toast.error('Payment cancelled. Your cart has been restored.');
          }
        }
      })
      .catch(() => {
        this.placing = false;
        this.toast.error('Could not open the payment window. Please try again.');
      });
  }
}
