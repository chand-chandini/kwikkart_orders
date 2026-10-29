import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthService } from '../../../core/services/auth.service';
import { AuthCardComponent } from '../../../shared/components/auth-card/auth-card.component';

@Component({
  selector: 'app-mobile-entry',
  standalone: true,
  imports: [FormsModule, RouterLink, AuthCardComponent],
  templateUrl: './mobile-entry.component.html'
})
export class MobileEntryComponent {
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  mobile = '';
  submitting = false;
  errorMessage = '';
  private code = '';
  private returnUrl = '';

  constructor() {
    this.code = this.route.parent?.snapshot.paramMap.get('code') ?? '';
    this.returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '';
  }

  submit(): void {
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
        this.router.navigate(['/o', this.code, 'auth', 'otp'], {
          queryParams: { mobile, returnUrl: this.returnUrl || null }
        });
      },
      error: () => {
        this.submitting = false;
      }
    });
  }
}
