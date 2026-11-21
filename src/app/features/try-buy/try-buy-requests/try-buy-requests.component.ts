import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';

import { TryBuyService } from '../../../core/services/try-buy.service';
import { ToastService } from '../../../core/services/toast.service';
import { AuthService } from '../../../core/services/auth.service';
import { ShareService } from '../../../core/services/share.service';
import { TryBuyRequest, TryBuyRequestLine, dayLabel, orderShareItems, tryBuyShareMessage } from '../../../core/models/try-buy.model';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';

type StatusKey = 'requested' | 'accepted' | 'rejected' | 'cancelled' | 'out_for_delivery' | 'delivered';

const STATUS_LABEL: Record<StatusKey, string> = {
  requested: 'Waiting for seller',
  accepted: 'Accepted',
  rejected: 'Declined',
  cancelled: 'Cancelled',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered'
};

// "My bookings" (ported from kkpublicapp's TryBuyRequestsScreen.jsx) -- the caller's own Try & Buy
// requests. An accepted request is an order under the hood, so its delivery progress (order_status
// 4/5) is shown as out_for_delivery/delivered once accepted.
@Component({
  selector: 'app-try-buy-requests',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, SpinnerComponent, EmptyStateComponent],
  templateUrl: './try-buy-requests.component.html'
})
export class TryBuyRequestsComponent implements OnInit {
  private readonly tryBuyApi = inject(TryBuyService);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);
  private readonly shareService = inject(ShareService);

  loading = true;
  requests: TryBuyRequest[] = [];
  error: string | null = null;
  cancellingId: number | null = null;
  sharingId: number | null = null;

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.tryBuyApi.listRequests().subscribe({
      next: (requests) => {
        this.requests = requests;
        this.error = null;
        this.loading = false;
      },
      error: () => {
        this.error = 'Could not load bookings';
        this.loading = false;
      }
    });
  }

  statusKey(req: TryBuyRequest): StatusKey {
    if (req.status === 'accepted' && req.order_status === 5) {
      return 'delivered';
    }
    if (req.status === 'accepted' && req.order_status === 4) {
      return 'out_for_delivery';
    }
    return req.status;
  }

  statusLabel(req: TryBuyRequest): string {
    return STATUS_LABEL[this.statusKey(req)] ?? req.status;
  }

  // @for's track expression crashes silently at runtime if it contains ?? or ?. -- moving the
  // null-coalescing into a method keeps the track expression itself free of that operator.
  itemKey(it: TryBuyRequestLine): string {
    return `${it.product_id}|${it.variant_id ?? ''}|${it.color ?? ''}`;
  }

  slotText(req: TryBuyRequest): string {
    if (!req.slot_label) {
      return '';
    }
    return req.slot_date ? `${dayLabel(req.slot_date)}, ${req.slot_label}` : req.slot_label;
  }

  // Rejected/cancelled bookings have nothing left to invite anyone into -- the server enforces
  // this too (TRY_BUY_ORDER_NOT_SHAREABLE) along with the one-hour-before-slot cutoff, so this is
  // just hiding the button where it would always fail rather than the only guard.
  canShare(req: TryBuyRequest): boolean {
    return req.status === 'requested' || req.status === 'accepted';
  }

  // "Share Try & Buy" on a placed booking -- ported from kkpublicapp's OrderDetailsScreen +
  // sharedTryBuyUi.jsx#shareTryBuyOrder. Opens a share tied to this request (so it takes its slot
  // and closes for adding an hour before it) and hands the invite to the device's share sheet;
  // friends who open the link land in the Kwik Kart app, not this web site.
  share(req: TryBuyRequest): void {
    const items = orderShareItems(req.items);
    if (!items.length) {
      this.toast.error('Nothing to share in this booking');
      return;
    }
    this.sharingId = req.id;
    this.tryBuyApi.createShare(items, req.id).subscribe({
      next: (result) => {
        this.sharingId = null;
        const message = tryBuyShareMessage({
          code: result.code,
          ownerName: this.auth.currentUser()?.name,
          storeName: req.vendor_name,
          slotText: this.slotText(req) || null,
          fee: req.delivery_charge
        });
        this.shareService.share(message, 'Try & Buy invite');
      },
      error: (err) => {
        this.sharingId = null;
        this.toast.error(err.message || 'Could not share this booking');
      }
    });
  }

  cancel(req: TryBuyRequest): void {
    this.cancellingId = req.id;
    this.tryBuyApi.cancelRequest(req.id).subscribe({
      next: () => {
        this.cancellingId = null;
        this.load();
      },
      error: (err) => {
        this.cancellingId = null;
        this.toast.error(err.message || 'Could not cancel this booking');
        this.load();
      }
    });
  }
}
