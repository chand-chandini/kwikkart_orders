import { Component, EventEmitter, Output } from '@angular/core';

// Shown once right after login (landing.component.ts / otp-verify.component.ts) to point
// customers at the app -- "Download App" opens the Play Store listing in a new tab and also
// dismisses the modal, since the store navigation underneath should still proceed either way.
@Component({
  selector: 'app-app-download-modal',
  standalone: true,
  templateUrl: './app-download-modal.component.html',
  styleUrl: './app-download-modal.component.scss'
})
export class AppDownloadModalComponent {
  @Output() closed = new EventEmitter<void>();

  readonly playStoreUrl = 'https://play.google.com/store/apps/details?id=com.kwikkart.user&pcampaignid=web_share';

  close(): void {
    this.closed.emit();
  }
}
