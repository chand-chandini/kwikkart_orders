import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { CheckoutService } from '../../../core/services/checkout.service';
import { ToastService } from '../../../core/services/toast.service';
import { Address, AddressPayload } from '../../../core/models/address.model';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';

const EMPTY_ADDRESS: AddressPayload = {
  contact_name: '',
  contact_phone: '',
  address_line: '',
  city: '',
  state: '',
  pincode: '',
  house_no: null,
  landmark: null,
  label: 'Home',
  latitude: null,
  longitude: null,
  is_default: false
};

@Component({
  selector: 'app-addresses',
  standalone: true,
  imports: [FormsModule, SpinnerComponent, EmptyStateComponent],
  templateUrl: './addresses.component.html'
})
export class AddressesComponent implements OnInit {
  private readonly checkout = inject(CheckoutService);
  private readonly toast = inject(ToastService);

  loading = true;
  addresses: Address[] = [];
  showForm = false;
  editingId: number | null = null;
  form: AddressPayload = { ...EMPTY_ADDRESS };
  locating = false;

  ngOnInit(): void {
    this.checkout.listAddresses().subscribe({
      next: (addresses) => {
        this.addresses = addresses;
        this.loading = false;
      },
      error: () => (this.loading = false)
    });
  }

  startAdd(): void {
    this.editingId = null;
    this.form = { ...EMPTY_ADDRESS };
    this.showForm = true;
  }

  startEdit(address: Address): void {
    this.editingId = address.id;
    const { id, ...rest } = address;
    this.form = { ...rest };
    this.showForm = true;
  }

  useMyLocation(): void {
    if (!navigator.geolocation) {
      this.toast.error('Location is not available on this browser.');
      return;
    }
    this.locating = true;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.form.latitude = pos.coords.latitude;
        this.form.longitude = pos.coords.longitude;
        this.locating = false;
      },
      () => {
        this.locating = false;
        this.toast.error('Could not get your location.');
      }
    );
  }

  save(): void {
    const request = this.editingId
      ? this.checkout.updateAddress(this.editingId, this.form)
      : this.checkout.createAddress(this.form);

    request.subscribe((address) => {
      if (this.editingId) {
        this.addresses = this.addresses.map((a) => (a.id === address.id ? address : a));
      } else {
        this.addresses = [...this.addresses, address];
      }
      this.showForm = false;
      this.toast.success('Address saved');
    });
  }

  remove(id: number): void {
    this.checkout.deleteAddress(id).subscribe(() => {
      this.addresses = this.addresses.filter((a) => a.id !== id);
      this.toast.success('Address removed');
    });
  }
}
