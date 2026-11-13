import { Injectable, computed, effect, signal } from '@angular/core';

import { TRY_BUY_MAX_QTY, TryBuyCartLine, lineIdOf } from '../models/try-buy.model';

const STORAGE_KEY = 'kk_try_buy_cart';

function loadInitial(): TryBuyCartLine[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const items = raw ? JSON.parse(raw) : [];
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

export type TryBuyAddResult = 'added' | 'increased' | 'max';

// Try & Buy's local-only selection list (ported from kkpublicapp's tryAtHomeSlice.js). Kept
// entirely apart from CartService (the server-backed shopping cart) -- this is only what the
// customer has picked; every price, charge and eligibility answer shown about it comes from
// TryBuyService.quote(), never from what's held here. Persisted to localStorage so a page
// refresh doesn't drop it, the way CartService doesn't need to (it always reloads from the
// server) but this local-only list would otherwise lose on every navigation.
@Injectable({ providedIn: 'root' })
export class TryBuyCartService {
  private readonly _items = signal<TryBuyCartLine[]>(loadInitial());
  readonly items = this._items.asReadonly();
  readonly count = computed(() => this._items().reduce((n, it) => n + it.quantity, 0));

  constructor() {
    effect(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._items()));
    });
  }

  // Same colour+size already in the list -> its quantity goes up (capped), mirroring
  // kkpublicapp's tryAtHomeSlice#addTryAtHomeItem.
  add(line: Omit<TryBuyCartLine, 'lineId' | 'quantity'>): TryBuyAddResult {
    const lineId = lineIdOf(line.productId, line.variantId, line.color);
    const existing = this._items().find((it) => it.lineId === lineId);
    if (existing) {
      if (existing.quantity >= TRY_BUY_MAX_QTY) {
        return 'max';
      }
      this._items.update((cur) =>
        cur.map((it) => (it.lineId === lineId ? { ...it, quantity: Math.min(it.quantity + 1, TRY_BUY_MAX_QTY) } : it))
      );
      return 'increased';
    }
    this._items.update((cur) => [...cur, { ...line, lineId, quantity: 1 }]);
    return 'added';
  }

  // One seller per Try & Buy list -- the name of an item already in the list that belongs to a
  // different vendor, if any (mirrors kkpublicapp's tryOtherSeller selector).
  otherSellerName(vendorId: number): string | null {
    const other = this._items().find((it) => it.vendorId !== vendorId);
    return other ? other.vendorName || 'another seller' : null;
  }

  clearOtherSellers(vendorId: number): void {
    this._items.update((cur) => cur.filter((it) => it.vendorId === vendorId));
  }

  updateQty(lineId: string, quantity: number): void {
    const q = Math.round(quantity);
    if (q < 1) {
      this.remove(lineId);
      return;
    }
    this._items.update((cur) => cur.map((it) => (it.lineId === lineId ? { ...it, quantity: Math.min(q, TRY_BUY_MAX_QTY) } : it)));
  }

  // Changes a line's size and/or colour. If that combination already has its own line, the two
  // merge (quantities added, capped) so a selection never appears twice -- same rule as
  // tryAtHomeSlice.updateTryAtHomeVariant.
  changeVariant(lineId: string, patch: { variantId?: number | null; color?: string | null }): void {
    const it = this._items().find((x) => x.lineId === lineId);
    if (!it) {
      return;
    }
    const variantId = 'variantId' in patch ? patch.variantId! : it.variantId;
    const color = 'color' in patch ? patch.color! : it.color;
    const nextId = lineIdOf(it.productId, variantId, color);
    if (nextId === lineId) {
      return;
    }
    const existing = this._items().find((x) => x.lineId === nextId);
    if (existing) {
      const mergedQty = Math.min(existing.quantity + it.quantity, TRY_BUY_MAX_QTY);
      this._items.update((cur) =>
        cur.filter((x) => x.lineId !== lineId).map((x) => (x.lineId === nextId ? { ...x, quantity: mergedQty } : x))
      );
      return;
    }
    const variantName = 'variantId' in patch ? it.sizeOptions.find((o) => o.id === variantId)?.name ?? it.variantName : it.variantName;
    this._items.update((cur) =>
      cur.map((x) => (x.lineId === lineId ? { ...x, variantId, variantName, color, lineId: nextId } : x))
    );
  }

  remove(lineId: string): void {
    this._items.update((cur) => cur.filter((it) => it.lineId !== lineId));
  }

  // Called after a request is submitted: drop exactly the lines that were sent.
  removeLines(lineIds: string[]): void {
    const ids = new Set(lineIds);
    this._items.update((cur) => cur.filter((it) => !ids.has(it.lineId)));
  }

  reset(): void {
    this._items.set([]);
  }
}
