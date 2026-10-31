import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService } from '../../core/services/auth.service';
import { OrgContextService } from '../../core/services/org-context.service';
import { ORG_RESOLVE_MESSAGES } from '../org-shell/org-unavailable.component';
import { AppError } from '../../core/models/api-error.model';
import { MembershipStatus } from '../../core/models/membership.model';
import { AuthCardComponent } from '../../shared/components/auth-card/auth-card.component';

type Step = 'mobile' | 'otp' | 'code';

// Root '/' route. Production traffic always arrives via /o/{code}; this page exists so a bare
// domain hit (or local dev) doesn't 404.
//
// Login comes before the store code (2026-10-31): previously this asked for the org code first,
// which meant a brand-new visitor had to know their store's code before they could even sign in.
// Now it's mobile -> OTP -> store code, reusing AuthService directly rather than the /o/:code
// nested auth routes (mobile-entry/otp-verify), which need an org code already in the URL to
// build their own navigation and so can't run before one exists.
@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [FormsModule, AuthCardComponent],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss'
})
export class LandingComponent {
  private readonly auth = inject(AuthService);
  private readonly orgContext = inject(OrgContextService);
  private readonly router = inject(Router);

  // Always starts at login, even if a session token is already stored -- a previously-verified
  // session shouldn't make the common entry point skip straight to the store-code box, which is
  // what made it look like "it asks for the invite code first" again.
  step: Step = 'mobile';

  mobile = '';
  otp = '';
  // Pre-filled from the last store code that resolved successfully (any device/session this
  // browser used before) -- login still runs every time, but a returning customer isn't stuck
  // retyping a code they already gave once; they land on the store step with it ready to confirm.
  code = this.orgContext.getLastCode() ?? '';
  submitting = false;
  errorMessage = '';

  sendOtp(): void {
    const mobile = this.mobile.trim();
    if (!/^\d{10}$/.test(mobile)) {
      this.errorMessage = 'Enter a valid 10-digit mobile number.';
      return;
    }
    this.errorMessage = '';
    this.submitting = true;
    this.auth.sendOtp(mobile).subscribe({
      next: () => {
        this.submitting = false;
        this.step = 'otp';
      },
      error: () => (this.submitting = false)
    });
  }

  verifyOtp(): void {
    if (!/^\d{4}$/.test(this.otp.trim())) {
      this.errorMessage = 'Enter the 4-digit OTP you received.';
      return;
    }
    this.errorMessage = '';
    this.submitting = true;
    this.auth.verifyOtp(this.mobile, this.otp.trim()).subscribe({
      next: () => {
        this.step = 'code';
        this.continueToExistingStore();
      },
      // verify_otp answers a wrong code with 401 ("incorrect otp") -- the same status a real
      // expired-session response uses, so the global error interceptor treats it as a silent
      // logout-and-redirect and skips its usual toast. Show the message inline here instead of
      // leaving the screen looking like nothing happened.
      error: (err: AppError) => {
        this.submitting = false;
        this.errorMessage = err.message || 'Incorrect OTP. Please try again.';
      }
    });
  }

  // Runs right after OTP verification: looks up every store this login is already an approved
  // customer of (server-side, so it works from any browser/device, not just the one that
  // resolved a code before) and continues straight into the most recently joined one. Falls back
  // to this browser's own last-used code (pre-filled into `code` already) only if the lookup
  // comes back empty or fails, and otherwise leaves the manual code step showing.
  private continueToExistingStore(): void {
    this.auth.listMyOrgs().subscribe({
      next: (orgs) => {
        const existing = orgs.find(
          (o) => o.membership_status === MembershipStatus.Approved && o.module_keys?.includes('super_mart') && o.store_code
        );
        if (existing?.store_code) {
          this.code = existing.store_code;
          this.goToStore();
          return;
        }
        this.submitting = false;
        if (this.code) {
          this.goToStore();
        }
      },
      error: () => {
        this.submitting = false;
        if (this.code) {
          this.goToStore();
        }
      }
    });
  }

  resendOtp(): void {
    this.auth.sendOtp(this.mobile).subscribe();
  }

  backToMobile(): void {
    this.otp = '';
    this.errorMessage = '';
    this.step = 'mobile';
  }

  goToStore(): void {
    const trimmed = this.code.trim();
    if (!trimmed) {
      return;
    }
    this.errorMessage = '';
    this.submitting = true;
    this.orgContext.resolve(trimmed).subscribe({
      next: (result) => {
        this.submitting = false;
        if (!result.valid) {
          this.errorMessage = ORG_RESOLVE_MESSAGES[result.reason].body;
          return;
        }
        // Still missing name/email: the org-scoped profile step is where that's filled in, same
        // as the direct /o/{code} sign-in path (otp-verify.component.ts), now that a code exists
        // to return to afterwards.
        const user = this.auth.currentUser();
        if (user && !user.is_profile_complete) {
          this.router.navigate(['/o', trimmed, 'auth', 'profile'], { queryParams: { returnUrl: `/o/${trimmed}` } });
        } else {
          this.router.navigate(['/o', trimmed]);
        }
      },
      error: () => {
        this.submitting = false;
        this.errorMessage = ORG_RESOLVE_MESSAGES.not_found.body;
      }
    });
  }
}
