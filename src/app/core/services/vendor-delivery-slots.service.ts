import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { SellerSlotProblem, SellerSlotRequest, VendorSlotSection } from '../models/order.model';

// Seller delivery slots for NORMAL orders (kkapi public_app 2026-11-24): one bookable-slot
// section per seller in the cart, loaded once for checkout. A seller with no bookable slot
// (has_slots: false) needs no pick and is left out of the request entirely -- that part of the
// order is simply placed without one (see vendorDeliverySlotsCtrl.js).
@Injectable({ providedIn: 'root' })
export class VendorDeliverySlotsService {
  private readonly http = inject(HttpClient);

  private readonly _sections = signal<VendorSlotSection[]>([]);
  private readonly _picks = signal<Record<number, SellerSlotRequest>>({}); // vendor_id -> pick
  private readonly _problems = signal<Record<number, string>>({}); // vendor_id -> message

  readonly sections = this._sections.asReadonly();
  readonly picks = this._picks.asReadonly();

  readonly sellersWithSlots = computed(() => this.sections().filter((s) => s.has_slots));

  // What placeOrder sends: one pick per seller that has a bookable slot.
  readonly sellerSlotsForOrder = computed<SellerSlotRequest[]>(() => Object.values(this.picks()));

  // Safe to submit once every seller that needs a pick has one (defaults fill this in as soon
  // as the sections load; false only while loading or if a picked slot was invalidated and no
  // default could replace it, e.g. every slot for that seller just filled up).
  readonly allPicked = computed(() => this.sellersWithSlots().every((s) => !!this.picks()[s.vendor_id]));

  // Call once the checkout page knows the org -- loads the live per-seller slot sections and
  // defaults every seller that has one to its earliest bookable slot, keeping an existing pick
  // if it's still valid (so re-fetching after a "slot unavailable" error doesn't throw away a
  // choice that's still good).
  attach(orgId: number): void {
    this.http
      .get<{ data: { sellers: VendorSlotSection[] } }>(`${environment.apiBaseUrl}/ecommerce/checkout/delivery-slots`, {
        params: { org_id: orgId }
      })
      .pipe(map((res) => res.data.sellers))
      .subscribe((sections) => {
        this._sections.set(sections);
        this._picks.update((cur) => {
          const next: Record<number, SellerSlotRequest> = {};
          sections.forEach((s) => {
            if (!s.has_slots) return;
            const existing = cur[s.vendor_id];
            const stillValid = !!existing && s.days.some((d) => d.date === existing.date && d.slots.some((sl) => sl.slot_id === existing.slot_id));
            if (stillValid) {
              next[s.vendor_id] = existing;
            } else if (s.default) {
              next[s.vendor_id] = { vendor_id: s.vendor_id, slot_id: s.default.slot_id, date: s.default.date };
            }
          });
          return next;
        });
      });
  }

  sectionFor(vendorId: number): VendorSlotSection | null {
    return this.sections().find((s) => s.vendor_id === vendorId) ?? null;
  }

  pickFor(vendorId: number): SellerSlotRequest | null {
    return this.picks()[vendorId] ?? null;
  }

  problemFor(vendorId: number): string | null {
    return this._problems()[vendorId] ?? null;
  }

  pick(vendorId: number, slotId: number, date: string): void {
    this._picks.update((cur) => ({ ...cur, [vendorId]: { vendor_id: vendorId, slot_id: slotId, date } }));
    this._problems.update((cur) => {
      const next = { ...cur };
      delete next[vendorId];
      return next;
    });
  }

  // From placeOrder's delivery_slot_required / delivery_slot_unavailable 400 -- shown under the
  // affected seller's section until the buyer picks again (or attach() refetches a default).
  setProblems(problems: SellerSlotProblem[]): void {
    const map: Record<number, string> = {};
    problems.forEach((p) => (map[p.vendor_id] = p.message));
    this._problems.set(map);
  }

  reset(): void {
    this._sections.set([]);
    this._picks.set({});
    this._problems.set({});
  }
}
