import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../../core/services/auth.service';
import { CartService } from '../../../core/services/cart.service';
import { OrgSummary } from '../../../core/models/org.model';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, FormsModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent {
  @Input({ required: true }) org!: OrgSummary;
  @Input({ required: true }) orgCode!: string;
  @Output() searchSubmit = new EventEmitter<string>();

  searchTerm = '';

  constructor(
    public authService: AuthService,
    public cartService: CartService,
    private router: Router
  ) {}

  onSearch(): void {
    const q = this.searchTerm.trim();
    if (!q) {
      return;
    }
    this.router.navigate(['/o', this.orgCode, 'search'], { queryParams: { q } });
  }

  logout(): void {
    this.authService.logout();
    this.cartService.reset();
    this.router.navigate(['/o', this.orgCode]);
  }
}
