import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './profile.component.html'
})
export class ProfileComponent {
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  name = this.auth.currentUser()?.name ?? '';
  email = this.auth.currentUser()?.email ?? '';
  saving = false;

  get mobile(): string {
    return this.auth.currentUser()?.mobile ?? '';
  }

  save(): void {
    this.saving = true;
    this.auth.updateProfile({ name: this.name.trim(), email: this.email.trim() || undefined }).subscribe({
      next: () => {
        this.saving = false;
        this.toast.success('Profile updated');
      },
      error: () => (this.saving = false)
    });
  }
}
