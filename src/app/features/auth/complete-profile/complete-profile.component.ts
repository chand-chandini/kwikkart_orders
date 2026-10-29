import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { AuthService } from '../../../core/services/auth.service';
import { AuthCardComponent } from '../../../shared/components/auth-card/auth-card.component';

@Component({
  selector: 'app-complete-profile',
  standalone: true,
  imports: [FormsModule, AuthCardComponent],
  templateUrl: './complete-profile.component.html'
})
export class CompleteProfileComponent {
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  name = '';
  email = '';
  submitting = false;
  errorMessage = '';
  private code = '';
  private returnUrl = '';

  constructor() {
    this.code = this.route.parent?.snapshot.paramMap.get('code') ?? '';
    this.returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '';
  }

  submit(): void {
    const name = this.name.trim();
    if (!name) {
      this.errorMessage = 'Please enter your name.';
      return;
    }
    this.errorMessage = '';
    this.submitting = true;
    this.auth.completeProfile({ name, email: this.email.trim() || undefined }).subscribe({
      next: () => {
        this.submitting = false;
        this.router.navigateByUrl(this.returnUrl || `/o/${this.code}`);
      },
      error: () => {
        this.submitting = false;
      }
    });
  }
}
