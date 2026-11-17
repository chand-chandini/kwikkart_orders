import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { OrgContextService } from '../../core/services/org-context.service';
import { CartService } from '../../core/services/cart.service';
import { CartCouponsService } from '../../core/services/cart-coupons.service';
import { VendorDeliverySlotsService } from '../../core/services/vendor-delivery-slots.service';
import { CheckoutService } from '../../core/services/checkout.service';
import { PaymentsService } from '../../core/services/payments.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { Address, AddressPayload, PickedLocation } from '../../core/models/address.model';
import { CartItem } from '../../core/models/cart.model';
import { DeliverySlot, PaymentMethod, SellerSlotProblem, VendorSlotSection } from '../../core/models/order.model';
import { AppError } from '../../core/models/api-error.model';
import { SpinnerComponent } from '../../shared/components/spinner/spinner.component';
import { LocationPickerModalComponent } from '../../shared/components/location-picker-modal/location-picker-modal.component';

// Mirrors kkapi public_app/utils/serviceability.js#message -- same reasons, same phrasing style.
const SERVICEABILITY_MESSAGES: Record<string, string> = {
  out_of_range: "it's outside the delivery area",
  no_store_location: "the store hasn't set its location yet",
  no_delivery_radius: "the seller hasn't set a delivery area yet"
};

function serviceabilityMessage(reason: string | null | undefined): string {
  return SERVICEABILITY_MESSAGES[reason ?? ''] ?? "it isn't deliverable here";
}

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
  imports: [FormsModule, CurrencyPipe, DatePipe, RouterLink, SpinnerComponent, LocationPickerModalComponent],
  templateUrl: './checkout.component.html'
})
export class CheckoutComponent implements OnInit {
  private readonly orgContext = inject(OrgContextService);
  readonly cartService = inject(CartService);
  readonly coupons = inject(CartCouponsService);
  readonly vendorSlots = inject(VendorDeliverySlotsService);
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
  instructions = '';

  showAddressForm = false;
  newAddress: AddressPayload = { ...EMPTY_ADDRESS };
  locating = false;
  addressFormError: string | null = null;
  showLocationPicker = false;

  // Surfaced from placeOrder's 400 (not_serviceable / address_location_required /
  // insufficient_stock / out_of_stock) -- these are in the error interceptor's SILENT_CODES set
  // specifically so this component can show them inline instead of a generic toast; previously
  // nothing here did, so placeOrder appeared to just silently fail for a blocked address.
  checkoutError: string | null = null;
  blockedItemIds = new Set<number>();
  removingBlockedId: number | null = null;

  // Which day's slots are showing per seller -- ephemeral UI state, not part of the pick itself
  // (vendorSlots.picks holds that). Defaults to the picked day, else the section's first day.
  private activeDayByVendor: Record<number, string> = {};

  get orgCode(): string {
    return this.orgContext.getCurrentCode() ?? '';
  }

  // Pre-emptive warning, shown as soon as an address is selected (its coords come back on the
  // cart annotated per item) -- so the buyer finds out an item can't be delivered before
  // attempting to place the order, not only after a blocked 400.
  get unserviceableItems(): CartItem[] {
    return this.cartService.cart().items.filter((item) => item.is_serviceable === 0);
  }

  serviceabilityReason(item: CartItem): string {
    return serviceabilityMessage(item.serviceability);
  }

  get codEnabled(): boolean {
    return !!this.orgContext.accessFlags()?.cod_enabled;
  }

  get onlineEnabled(): boolean {
    return !!this.orgContext.accessFlags()?.online_payment_enabled;
  }

  vendorName(vendorId: number): string {
    return this.cartService.cart().vendors.find((v) => v.vendor_id === vendorId)?.vendor_name ?? 'Seller';
  }

  activeDayFor(section: VendorSlotSection): string {
    const active = this.activeDayByVendor[section.vendor_id];
    if (active && section.days.some((d) => d.date === active)) return active;
    return this.vendorSlots.pickFor(section.vendor_id)?.date ?? section.days[0]?.date ?? '';
  }

  setActiveDay(vendorId: number, date: string): void {
    this.activeDayByVendor[vendorId] = date;
  }

  pickVendorSlot(vendorId: number, slotId: number, date: string): void {
    this.vendorSlots.pick(vendorId, slotId, date);
    this.activeDayByVendor[vendorId] = date;
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
    this.vendorSlots.attach(orgId);
    this.cartService.load(orgId).subscribe({
      next: () => {
        this.loading = false;
        // Normally already attached from the cart page -- this covers landing on checkout
        // directly (a bookmark, a refresh) where that never happened.
        this.coupons.attach(orgId);
      },
      error: () => (this.loading = false)
    });
    if (!this.codEnabled && this.onlineEnabled) {
      this.paymentMethod = 'online';
    }
  }

  selectAddress(id: number): void {
    this.selectedAddressId = id;
    this.checkoutError = null;
    this.blockedItemIds = new Set();
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

  // Search a place or drop a pin, and city/state/pincode/the map coords fill in from it --
  // house no., landmark, name and phone still need typing, same as "Use my current location".
  onLocationPicked(loc: PickedLocation): void {
    this.newAddress.address_line = loc.address_line;
    this.newAddress.city = loc.city;
    this.newAddress.state = loc.state;
    this.newAddress.pincode = loc.pincode;
    this.newAddress.latitude = loc.latitude;
    this.newAddress.longitude = loc.longitude;
    this.showLocationPicker = false;
  }

  saveAddress(): void {
    this.addressFormError = null;
    if (!/^\d{10}$/.test(this.newAddress.contact_phone.trim())) {
      this.addressFormError = 'Enter a valid 10-digit phone number.';
      return;
    }
    if (!/^\d{6}$/.test(this.newAddress.pincode.trim())) {
      this.addressFormError = 'Enter a valid 6-digit pincode.';
      return;
    }
    // Without a pin, delivery charge/serviceability checks fail later with no clue why -- catching
    // it here, where "Use my current location" is right above, is the actual fix rather than a
    // cryptic error after placing the order.
    if (this.newAddress.latitude == null || this.newAddress.longitude == null) {
      this.addressFormError = 'Tap "Use my current location" to set this address\'s map pin before saving.';
      return;
    }

    this.checkout.createAddress(this.newAddress).subscribe((address) => {
      this.addresses = [...this.addresses, address];
      this.newAddress = { ...EMPTY_ADDRESS };
      this.showAddressForm = false;
      this.selectAddress(address.id);
    });
  }

  placeOrder(): void {
    if (!this.selectedAddressId) {
      this.toast.error('Please select or add a delivery address.');
      return;
    }
    this.checkoutError = null;
    this.blockedItemIds = new Set();
    this.placing = true;
    this.checkout
      .placeOrder({
        address_id: this.selectedAddressId,
        payment_method: this.paymentMethod,
        delivery_slot_id: this.selectedSlotId ?? undefined,
        org_id: this.orgContext.requireOrgId(),
        coupon_code: this.coupons.platformApplied() ? this.coupons.platformCode() ?? undefined : undefined,
        seller_coupons: this.coupons.appliedSellerCoupons(),
        seller_slots: this.vendorSlots.sellerSlotsForOrder(),
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
        error: (err: AppError) => {
          this.placing = false;
          this.handlePlaceOrderError(err);
        }
      });
  }

  // not_serviceable / address_location_required / insufficient_stock / out_of_stock all arrive
  // here (the interceptor deliberately skips the global toast for these -- see SILENT_CODES).
  // Anything else was already toasted globally; nothing further to do for it here.
  private handlePlaceOrderError(err: AppError): void {
    switch (err.code) {
      case 'not_serviceable': {
        this.checkoutError = err.message;
        const items = (err.raw as { items?: { cart_item_id: number }[] })?.items ?? [];
        this.blockedItemIds = new Set(items.map((i) => i.cart_item_id));
        // Re-pull the cart WITH the address so is_serviceable on each item matches what the
        // backend just refused -- unserviceableItems then renders the same items this came back
        // with, instead of relying on blockedItemIds as a second, separately-displayed list.
        this.cartService.load(this.orgContext.requireOrgId(), this.selectedAddressId ?? undefined).subscribe();
        break;
      }
      case 'address_location_required':
        this.checkoutError = err.message;
        break;
      case 'insufficient_stock':
      case 'out_of_stock':
        this.checkoutError = err.message;
        // Stock changed server-side since the page loaded -- resync so qty/availability reflect it.
        this.cartService.load(this.orgContext.requireOrgId(), this.selectedAddressId ?? undefined).subscribe();
        break;
      case 'coupon_invalid':
        // A coupon stopped applying between the last preview and placing the order (expired,
        // used up, cart fell below its minimum) -- re-price so the cart/checkout pages show why,
        // same as kkpublicapp's CheckoutScreen does on this code.
        this.checkoutError = err.message;
        this.coupons.attach(this.orgContext.requireOrgId());
        break;
      case 'delivery_slot_required':
      case 'delivery_slot_unavailable': {
        // A seller's slot wasn't picked, or filled up / closed between loading the sections and
        // placing the order -- refetch so the section shows what's bookable now (attach() keeps
        // any pick that's still valid and defaults the rest), and flag which seller(s) it was.
        this.checkoutError = err.message;
        const problems = (err.raw as { slots?: SellerSlotProblem[] })?.slots ?? [];
        this.vendorSlots.setProblems(problems);
        this.vendorSlots.attach(this.orgContext.requireOrgId());
        break;
      }
      default:
        break;
    }
  }

  // Lets the buyer clear a blocked item right from the warning instead of bouncing back to the
  // cart page -- re-loaded WITH the selected address so the remaining items keep their
  // serviceability annotation (CartService.removeItem's own reload omits address_id).
  removeBlockedItem(itemId: number): void {
    this.removingBlockedId = itemId;
    this.cartService.removeItem(this.orgContext.requireOrgId(), itemId).subscribe({
      next: () => {
        this.cartService.load(this.orgContext.requireOrgId(), this.selectedAddressId ?? undefined).subscribe(() => {
          this.removingBlockedId = null;
          this.blockedItemIds.delete(itemId);
          if (this.blockedItemIds.size === 0) {
            this.checkoutError = null;
          }
        });
      },
      error: () => (this.removingBlockedId = null)
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
