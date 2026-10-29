import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { AuthService } from '../../../core/services/auth.service';
import { AuthCardComponent } from '../../../shared/components/auth-card/auth-card.component';

@Component({
  selector: 'app-otp-verify',
  standalone: true,
  imports: [FormsModule, AuthCardComponent],
  templateUrl: './otp-verify.component.html'
})
export class OtpVerifyComponent {
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  mobile = '';
  otp = '';
  submitting = false;
  errorMessage = '';
  private code = '';
  private returnUrl = '';

  constructor() {
    this.code = this.route.parent?.snapshot.paramMap.get('code') ?? '';
    this.mobile = this.route.snapshot.queryParamMap.get('mobile') ?? '';
    this.returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '';
    if (!this.mobile) {
      this.router.navigate(['/o', this.code, 'auth', 'mobile']);
    }
  }

  submit(): void {
    if (!/^\d{4}$/.test(this.otp.trim())) {
      this.errorMessage = 'Enter the 4-digit OTP you received.';
      return;
    }
    this.errorMessage = '';
    this.submitting = true;
    this.auth.verifyOtp(this.mobile, this.otp.trim()).subscribe({
      next: (data) => {
        this.submitting = false;
        if (!data.user.is_profile_complete) {
          this.router.navigate(['/o', this.code, 'auth', 'profile'], {
            queryParams: { returnUrl: this.returnUrl || null }
          });
        } else {
          this.router.navigateByUrl(this.returnUrl || `/o/${this.code}`);
        }
      },
      error: () => {
        this.submitting = false;
      }
    });
  }

  resend(): void {
    this.auth.sendOtp(this.mobile).subscribe();
  }
}
