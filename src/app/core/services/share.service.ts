import { Injectable, inject } from '@angular/core';

import { ToastService } from './toast.service';

// Web equivalent of kkpublicapp's Share.share() (sharedTryBuyUi.jsx#shareTryBuyInvite/
// shareTryBuyOrder) -- the Web Share API opens the browser/OS share sheet where available
// (mobile browsers, most desktop browsers behind HTTPS); where it isn't, the invite text/link
// is copied to the clipboard instead so the user can paste it anywhere.
@Injectable({ providedIn: 'root' })
export class ShareService {
  private readonly toast = inject(ToastService);

  async share(text: string, title = 'Kwik Kart'): Promise<void> {
    if (navigator.share) {
      try {
        await navigator.share({ title, text });
        return;
      } catch (err) {
        if ((err as DOMException)?.name === 'AbortError') {
          return; // user dismissed the native share sheet -- not an error
        }
      }
    }
    await this.copyToClipboard(text);
  }

  private async copyToClipboard(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.toast.success('Invite link copied to clipboard');
    } catch {
      this.toast.error('Could not copy the invite link');
    }
  }
}
