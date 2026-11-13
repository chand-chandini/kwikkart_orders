import { CurrencyPipe } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';

import { CatalogService } from '../../../core/services/catalog.service';
import { ColourOption, ProductDetail } from '../../../core/models/product.model';
import { TryBuySizeOption, tryBuySizesOf } from '../../../core/models/try-buy.model';

export interface TrySelection {
  product: ProductDetail;
  size: TryBuySizeOption;
  colourName: string | null;
}

interface SheetColour {
  productId: number;
  name: string | null;
  image: string | null;
}

interface Picked {
  productId: number;
  variantId: number | null;
}

interface Resolved {
  key: string;
  detail: ProductDetail | 'error' | undefined;
  size: TryBuySizeOption | null;
  ok: boolean;
  colourName: string | null;
}

const keyOf = (productId: number, variantId: number | null) => `${productId}|${variantId ?? ''}`;
const serverColourOf = (detail: ProductDetail | undefined): string | null => (detail?.try_buy?.colors ?? [])[0] ?? null;

function discountPercent(price: number, mrp: number | null): number {
  if (!mrp || mrp <= price) {
    return 0;
  }
  return Math.round(((mrp - price) / mrp) * 100);
}

// Try & Buy selection sheet (ported from kkpublicapp's TryBuySelectSheet.jsx). Every "Colour" of
// a design is its own product row (style_group_id siblings, listed by the server as
// product.colour_options) -- so a colour's full data is simply CatalogService.getProduct(that
// colour's product_id), the same call the product detail page itself used to get here. Lets the
// buyer multi-select several colour/size combinations in one go before adding them all at once.
@Component({
  selector: 'app-try-buy-select-sheet',
  standalone: true,
  imports: [CurrencyPipe],
  templateUrl: './try-buy-select-sheet.component.html',
  styleUrl: './try-buy-select-sheet.component.scss'
})
export class TryBuySelectSheetComponent implements OnInit {
  @Input({ required: true }) product!: ProductDetail;
  @Input() otherSeller: string | null = null;
  @Output() closed = new EventEmitter<void>();
  @Output() confirmed = new EventEmitter<TrySelection[]>();

  private readonly catalog = inject(CatalogService);

  readonly discountPercent = discountPercent;

  colours: SheetColour[] = [];
  details: Record<number, ProductDetail | 'error' | undefined> = {};
  activeId = 0;
  picked: Picked[] = [];
  error: string | null = null;

  get label(): string {
    return this.product.try_buy?.label || 'Try & Buy';
  }

  ngOnInit(): void {
    this.activeId = this.product.id;
    this.details = { [this.product.id]: this.product };

    const opts = this.product.colour_options ?? [];
    this.colours =
      opts.length > 1
        ? opts.map((o: ColourOption) => ({ productId: o.product_id, name: o.colour, image: o.image_url }))
        : [{ productId: this.product.id, name: serverColourOf(this.product), image: this.product.image_url }];

    this.colours
      .filter((c) => c.productId !== this.product.id)
      .forEach((c) => {
        this.catalog.getProduct(c.productId).subscribe({
          next: (detail) => (this.details = { ...this.details, [c.productId]: detail }),
          error: () => (this.details = { ...this.details, [c.productId]: 'error' })
        });
      });
  }

  colourName(c: SheetColour, i: number): string {
    return c.name || serverColourOf(this.details[c.productId] as ProductDetail | undefined) || `Colour ${i + 1}`;
  }

  colourIndex(productId: number): number {
    return this.colours.findIndex((c) => c.productId === productId);
  }

  get active(): ProductDetail | 'error' | undefined {
    return this.details[this.activeId];
  }

  get activeLoaded(): boolean {
    return !!this.active && this.active !== 'error';
  }

  get activeSizes(): TryBuySizeOption[] {
    return this.activeLoaded ? tryBuySizesOf(this.active as ProductDetail) : [];
  }

  get activeSizesHaveNames(): boolean {
    return this.activeSizes.some((s) => !!s.name);
  }

  get activeDetail(): ProductDetail | null {
    return this.activeLoaded ? (this.active as ProductDetail) : null;
  }

  get activeImages(): { id: string | number; image_url: string }[] {
    if (!this.activeLoaded) {
      return [];
    }
    const detail = this.active as ProductDetail;
    if (detail.images.length) {
      return detail.images;
    }
    return detail.image_url ? [{ id: 'main', image_url: detail.image_url }] : [];
  }

  isPicked(variantId: number | null): boolean {
    return this.picked.some((p) => p.productId === this.activeId && p.variantId === variantId);
  }

  pickedCountFor(productId: number): number {
    return this.picked.filter((p) => p.productId === productId).length;
  }

  toggle(size: TryBuySizeOption): void {
    if (!size.available) {
      return;
    }
    this.error = null;
    if (this.isPicked(size.id)) {
      this.picked = this.picked.filter((p) => !(p.productId === this.activeId && p.variantId === size.id));
    } else {
      this.picked = [...this.picked, { productId: this.activeId, variantId: size.id }];
    }
  }

  remove(key: string): void {
    this.error = null;
    this.picked = this.picked.filter((p) => keyOf(p.productId, p.variantId) !== key);
  }

  get resolved(): Resolved[] {
    return this.picked.map((p) => {
      const detail = this.details[p.productId];
      const size = detail && detail !== 'error' ? tryBuySizesOf(detail).find((s) => s.id === p.variantId) ?? null : null;
      const i = this.colourIndex(p.productId);
      return {
        key: keyOf(p.productId, p.variantId),
        detail,
        size,
        ok: !!size?.available,
        colourName: i >= 0 ? this.colourName(this.colours[i], i) : null
      };
    });
  }

  // @for's track expression crashes silently at runtime if it contains ?? or ?. -- it compiled
  // fine but the loop just rendered nothing. Routing the null-id ("default" row) case through a
  // plain method keeps the track expression itself free of that operator.
  sizeKey(s: TryBuySizeOption): string | number {
    return s.id === null ? 'default' : s.id;
  }

  setActive(productId: number): void {
    this.activeId = productId;
  }

  confirm(): void {
    const resolved = this.resolved;
    if (!resolved.length) {
      this.error = 'Select at least one colour and size';
      return;
    }
    if (resolved.some((r) => !r.ok)) {
      this.error = 'Remove the selections that are no longer available';
      return;
    }
    const details = resolved.map((r) => r.detail as ProductDetail);
    if (new Set(details.map((d) => d.vendor_id)).size > 1) {
      this.error = `These colours are sold by different sellers. ${this.label} takes one seller at a time.`;
      return;
    }
    this.confirmed.emit(
      resolved.map((r) => ({
        product: r.detail as ProductDetail,
        size: r.size as TryBuySizeOption,
        colourName: r.colourName
      }))
    );
  }

  close(): void {
    this.closed.emit();
  }

  selTitle(r: Resolved): string {
    const parts = [r.colourName, r.size?.name].filter((p): p is string => !!p);
    if (parts.length) {
      return parts.join(' · ');
    }
    return r.detail && r.detail !== 'error' ? r.detail.name : '';
  }
}
