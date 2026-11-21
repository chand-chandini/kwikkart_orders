import { CurrencyPipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { OrgContextService } from '../../../core/services/org-context.service';
import { TryBuyCartService } from '../../../core/services/try-buy-cart.service';
import { TryBuyService } from '../../../core/services/try-buy.service';
import { CheckoutService } from '../../../core/services/checkout.service';
import { ToastService } from '../../../core/services/toast.service';
import { AuthService } from '../../../core/services/auth.service';
import { ShareService } from '../../../core/services/share.service';
import { Address, AddressPayload, PickedLocation } from '../../../core/models/address.model';
import { AppError } from '../../../core/models/api-error.model';
import {
  TRY_BUY_MAX_QTY,
  TryBuyCartLine,
  TryBuyQuote,
  TryBuyQuoteLine,
  TryBuySeller,
  TryBuySlot,
  TryBuySlotPick,
  TryBuySlotsResponse,
  dayLabel,
  lineIdOf,
  toQuoteItems,
  tryBuyShareMessage
} from '../../../core/models/try-buy.model';
import { QtyStepperComponent } from '../../../shared/components/qty-stepper/qty-stepper.component';
import { LocationPickerModalComponent } from '../../../shared/components/location-picker-modal/location-picker-modal.component';

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

interface TryBuyGroup {
  vendorId: number;
  vendorName: string;
  items: TryBuyCartLine[];
}

// The Try & Buy cart page (ported from kkpublicapp's TryAtHomeCartScreen.jsx). The list itself is
// TryBuyCartService's local selection; everything shown about it -- prices, availability, each
// seller's Try & Buy delivery charge -- comes from the server's live quote. Nothing here touches
// the normal cart, coupons or payment, and no payment is taken.
@Component({
  selector: 'app-try-buy-cart',
  standalone: true,
  imports: [CurrencyPipe, FormsModule, RouterLink, QtyStepperComponent, LocationPickerModalComponent],
  templateUrl: './try-buy-cart.component.html',
  styleUrl: './try-buy-cart.component.scss'
})
export class TryBuyCartComponent implements OnInit {
  private readonly orgContext = inject(OrgContextService);
  readonly tryBuyCart = inject(TryBuyCartService);
  private readonly tryBuyApi = inject(TryBuyService);
  private readonly checkout = inject(CheckoutService);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);
  private readonly shareService = inject(ShareService);
  private readonly router = inject(Router);

  readonly TRY_BUY_MAX_QTY = TRY_BUY_MAX_QTY;

  quote: TryBuyQuote | null = null;
  quoting = false;
  quoteError: string | null = null;
  private quoteSeq = 0;

  addresses: Address[] | null = null; // null = loading
  addressId: number | null = null;
  showAddressForm = false;
  newAddress: AddressPayload = { ...EMPTY_ADDRESS };
  locating = false;
  addressFormError: string | null = null;
  showLocationPicker = false;

  slotData: TryBuySlotsResponse | null = null;
  slotsError: string | null = null;
  slotDate: string | null = null;
  slotPick: TryBuySlotPick | null = null;
  slotsOpen = false;
  private slotSeq = 0;

  note = '';
  editingLineId: string | null = null;
  submitting = false;
  sharing = false;

  get orgCode(): string {
    return this.orgContext.getCurrentCode() ?? '';
  }

  get items(): TryBuyCartLine[] {
    return this.tryBuyCart.items();
  }

  get label(): string {
    return this.quote?.label ?? 'Try & Buy';
  }

  get groups(): TryBuyGroup[] {
    const order: string[] = [];
    const by: Record<string, TryBuyGroup> = {};
    for (const it of this.items) {
      const key = String(it.vendorId);
      if (!by[key]) {
        by[key] = { vendorId: it.vendorId, vendorName: it.vendorName || 'Seller', items: [] };
        order.push(key);
      }
      by[key].items.push(it);
    }
    return order.map((k) => by[k]);
  }

  get sellerId(): number | null {
    const g = this.groups;
    return g.length === 1 ? g[0].vendorId : null;
  }

  get lineByKey(): Record<string, TryBuyQuoteLine> {
    const m: Record<string, TryBuyQuoteLine> = {};
    (this.quote?.sellers ?? []).forEach((s) => s.items.forEach((l) => (m[l.key] = l)));
    return m;
  }

  liveLine(lineId: string): TryBuyQuoteLine | undefined {
    return this.lineByKey[lineId];
  }

  isUnavailable(lineId: string): boolean {
    const live = this.liveLine(lineId);
    return !!live && !live.available;
  }

  get sellerById(): { [vendorId: number]: TryBuySeller | undefined } {
    const m: { [vendorId: number]: TryBuySeller | undefined } = {};
    (this.quote?.sellers ?? []).forEach((s) => {
      if (s.vendor_id != null) {
        m[s.vendor_id] = s;
      }
    });
    return m;
  }

  sellerDeliveryCharge(vendorId: number): number | null {
    return this.sellerById[vendorId]?.delivery_charge ?? null;
  }

  get unavailable(): number {
    return this.quote?.unavailable_count ?? 0;
  }

  get selectedAddress(): Address | null {
    return (this.addresses ?? []).find((a) => a.id === this.addressId) ?? null;
  }

  get canRequest(): boolean {
    return (
      !!this.quote &&
      !this.quoting &&
      !this.quoteError &&
      this.unavailable === 0 &&
      !!this.selectedAddress &&
      !this.submitting &&
      !!this.sellerId &&
      !!this.slotPick
    );
  }

  // Sharing only needs a single seller's worth of items -- unlike canRequest it doesn't wait on
  // an address/slot, since those are picked after the invite is sent (mirrors kkpublicapp's
  // "Share Try & Buy" card, which sits above the booking-details form).
  get canShare(): boolean {
    return !!this.sellerId && this.items.length > 0 && !this.sharing;
  }

  get blocker(): string | null {
    if (!this.quote || this.quoting || this.submitting) {
      return null;
    }
    if (this.unavailable) {
      return 'Remove the unavailable items to continue';
    }
    if (!this.sellerId) {
      return 'Keep one seller to continue';
    }
    if (this.addresses !== null && !this.selectedAddress) {
      return 'Add a delivery address to continue';
    }
    if (this.slotData && !this.slotPick) {
      return 'Choose a delivery slot to continue';
    }
    return null;
  }

  ngOnInit(): void {
    this.refreshQuote();
    this.loadSlots();
    this.checkout.listAddresses().subscribe((addresses) => {
      this.addresses = addresses;
      const def = addresses.find((a) => a.is_default) ?? addresses[0];
      if (def) {
        this.selectAddress(def.id);
      } else {
        this.showAddressForm = true;
      }
    });
  }

  refreshQuote(): void {
    const items = this.items;
    if (!items.length) {
      this.quote = null;
      return;
    }
    const seq = ++this.quoteSeq;
    this.quoting = true;
    this.quoteError = null;
    this.tryBuyApi.quote(toQuoteItems(items), this.addressId ?? undefined).subscribe({
      next: (q) => {
        if (seq !== this.quoteSeq) {
          return;
        }
        this.quote = q;
        this.quoting = false;
      },
      error: (err: AppError) => {
        if (seq !== this.quoteSeq) {
          return;
        }
        this.quoteError = err.message || 'Could not load prices';
        this.quoting = false;
      }
    });
  }

  loadSlots(): void {
    const vendorId = this.sellerId;
    if (!vendorId) {
      this.slotData = null;
      this.slotPick = null;
      return;
    }
    const seq = ++this.slotSeq;
    this.slotsError = null;
    this.tryBuyApi.vendorSlots(vendorId).subscribe({
      next: (data) => {
        if (seq !== this.slotSeq) {
          return;
        }
        this.slotData = data;
        this.syncSlotSelection();
      },
      error: (err: AppError) => {
        if (seq !== this.slotSeq) {
          return;
        }
        this.slotsError = err.message || 'Could not load delivery slots';
      }
    });
  }

  private syncSlotSelection(): void {
    const days = this.slotData?.days ?? [];
    if (!(this.slotDate && days.some((d) => d.date === this.slotDate))) {
      this.slotDate = (days.find((d) => d.slots.some((s) => s.state === 'available')) ?? days[0])?.date ?? null;
    }
    if (this.slotPick) {
      const still = this.findSlot(this.slotPick);
      if (!still || still.state !== 'available') {
        this.slotPick = null;
      }
    }
  }

  private findSlot(pick: TryBuySlotPick): TryBuySlot | null {
    const day = this.slotData?.days.find((d) => d.date === pick.date);
    return day?.slots.find((s) => s.slot_id === pick.slot_id) ?? null;
  }

  slotsForDate(date: string | null): TryBuySlot[] {
    return this.slotData?.days.find((d) => d.date === date)?.slots ?? [];
  }

  dayIsOpen(dateSlots: TryBuySlot[]): boolean {
    return dateSlots.some((s) => s.state === 'available');
  }

  dayLabelFor(ymd: string): string {
    return dayLabel(ymd, this.slotData?.today);
  }

  openSlots(): void {
    this.slotsOpen = true;
    this.loadSlots();
  }

  pickSlot(s: TryBuySlot): void {
    if (s.state !== 'available' || !this.slotDate) {
      return;
    }
    this.slotPick = { slot_id: s.slot_id, date: this.slotDate, label: s.label };
  }

  setQty(it: TryBuyCartLine, qty: number): void {
    if (qty > TRY_BUY_MAX_QTY) {
      this.toast.error(`Up to ${TRY_BUY_MAX_QTY} per item`);
      return;
    }
    if (qty < 1) {
      this.removeItem(it);
      return;
    }
    this.tryBuyCart.updateQty(it.lineId, qty);
    this.refreshQuote();
  }

  removeItem(it: TryBuyCartLine): void {
    this.tryBuyCart.remove(it.lineId);
    if (this.editingLineId === it.lineId) {
      this.editingLineId = null;
    }
    this.refreshQuote();
    this.loadSlots();
  }

  keepSeller(vendorId: number): void {
    const idsToRemove = this.items.filter((it) => it.vendorId !== vendorId).map((it) => it.lineId);
    this.tryBuyCart.removeLines(idsToRemove);
    this.refreshQuote();
    this.loadSlots();
  }

  toggleEdit(it: TryBuyCartLine): void {
    this.editingLineId = this.editingLineId === it.lineId ? null : it.lineId;
  }

  changeVariant(it: TryBuyCartLine, patch: { variantId?: number | null; color?: string | null }): void {
    this.tryBuyCart.changeVariant(it.lineId, patch);
    const variantId = 'variantId' in patch ? patch.variantId! : it.variantId;
    const color = 'color' in patch ? patch.color! : it.color;
    this.editingLineId = lineIdOf(it.productId, variantId, color);
    this.refreshQuote();
  }

  selectAddress(id: number): void {
    this.addressId = id;
    this.showAddressForm = false;
    this.refreshQuote();
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
    if (this.newAddress.latitude == null || this.newAddress.longitude == null) {
      this.addressFormError = 'Tap "Use my current location" to set this address\'s map pin before saving -- Try & Buy requires one.';
      return;
    }
    this.checkout.createAddress(this.newAddress).subscribe((address) => {
      this.addresses = [...(this.addresses ?? []), address];
      this.newAddress = { ...EMPTY_ADDRESS };
      this.selectAddress(address.id);
    });
  }

  // "Share Try & Buy" (ported from kkpublicapp's TryAtHomeCartScreen#shareTryBuy): opens or
  // refreshes a shareable booking for this list and hands the invite link/code to the device's
  // share sheet. Friends who open the link land in the Kwik Kart app (public app), never on this
  // web site -- the invite text/link is identical to the app's own share, and clicking it keeps
  // the app's existing install/open redirect. The items stay in this cart either way.
  shareTryBuy(): void {
    const vendorId = this.sellerId;
    if (!vendorId || !this.items.length) {
      this.toast.error(`Keep one seller to share ${this.label}`);
      return;
    }
    this.sharing = true;
    this.tryBuyApi.createShare(toQuoteItems(this.items)).subscribe({
      next: (result) => {
        this.sharing = false;
        const storeName = this.sellerById[vendorId]?.vendor_name || this.groups[0]?.vendorName || 'the store';
        const slotText = this.slotPick ? `${this.dayLabelFor(this.slotPick.date)}, ${this.slotPick.label}` : null;
        const message = tryBuyShareMessage({
          code: result.code,
          ownerName: this.auth.currentUser()?.name,
          storeName,
          slotText,
          fee: this.sellerDeliveryCharge(vendorId),
          label: this.label
        });
        this.shareService.share(message, `${this.label} invite`);
      },
      error: (err: AppError) => {
        this.sharing = false;
        this.toast.error(err.message || `Could not share ${this.label}`);
      }
    });
  }

  submit(): void {
    if (!this.selectedAddress) {
      this.toast.error('Choose a delivery address');
      return;
    }
    if (this.unavailable) {
      this.toast.error('Remove the unavailable items first');
      return;
    }
    const pick = this.slotPick;
    const vendorId = this.sellerId;
    if (!pick || !vendorId) {
      this.toast.error('Choose a delivery slot');
      return;
    }
    const sentLines = this.items.map((it) => it.lineId);
    const sellerName = this.groups[0]?.vendorName || 'the seller';
    this.submitting = true;

    // Availability can change while the cart is open -- check the slot again first.
    this.tryBuyApi.vendorSlots(vendorId).subscribe({
      next: (fresh) => {
        this.slotData = fresh;
        const still = this.findSlot(pick);
        if (!still || still.state !== 'available') {
          this.submitting = false;
          this.toast.error('That slot is no longer available. Please choose another slot.');
          this.slotPick = null;
          return;
        }
        this.tryBuyApi
          .createRequest({
            items: toQuoteItems(this.items),
            address_id: this.addressId!,
            slot_id: pick.slot_id,
            slot_date: pick.date,
            ...(this.note.trim() ? { note: this.note.trim() } : {})
          })
          .subscribe({
            next: () => {
              this.submitting = false;
              this.tryBuyCart.removeLines(sentLines);
              this.note = '';
              this.slotPick = null;
              this.toast.success(`${this.label} booked with ${sellerName}. No payment has been taken.`);
              this.router.navigate(['/o', this.orgCode, 'orders'], { queryParams: { tab: 'bookings' } });
            },
            error: (err: AppError) => {
              this.submitting = false;
              this.handleSubmitError(err);
            }
          });
      },
      error: () => {
        this.submitting = false;
        this.toast.error('Could not check the delivery slot. Please try again.');
      }
    });
  }

  private handleSubmitError(err: AppError): void {
    const code = String(err.code ?? '');
    if (code === 'SLOT_REQUIRED' || code === 'SLOT_UNAVAILABLE') {
      this.toast.error(err.message);
      this.slotPick = null;
      this.loadSlots();
    } else if (code === 'TRY_BUY_ONE_SELLER') {
      this.toast.error(err.message);
    } else if (code === 'TRY_BUY_UNAVAILABLE') {
      const data = (err.raw as { data?: TryBuyQuote } | undefined)?.data;
      if (data) {
        this.quote = data;
      }
      this.toast.error('Some items changed – please review them');
    } else if (code === 'ADDRESS_LOCATION_MISSING') {
      this.toast.error(err.message);
      this.showAddressForm = true;
    } else {
      this.toast.error(err.message || 'Could not place the booking');
    }
  }

  continueShopping(): void {
    this.router.navigate(['/o', this.orgCode]);
  }
}
