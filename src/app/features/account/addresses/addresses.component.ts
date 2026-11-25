import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { CheckoutService } from '../../../core/services/checkout.service';
import { ToastService } from '../../../core/services/toast.service';
import { Address, AddressPayload, PickedLocation } from '../../../core/models/address.model';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { LocationPickerModalComponent } from '../../../shared/components/location-picker-modal/location-picker-modal.component';

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
  imports: [FormsModule, SpinnerComponent, EmptyStateComponent, LocationPickerModalComponent],
  templateUrl: './addresses.component.html'
})
export class AddressesComponent implements OnInit {
  private readonly checkout = inject(CheckoutService);
  private readonly toast = inject(ToastService);
  isEditing = false;
  loading = true;
  addresses: Address[] = [];
  showForm = false;
  editingId: number | null = null;
  form: AddressPayload = { ...EMPTY_ADDRESS };
  locating = false;
  formError: string | null = null;
  showLocationPicker = false;

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
    this.isEditing = false; 
    this.form = { ...EMPTY_ADDRESS };
    this.formError = null;
    this.showForm = true;
  }

  startEdit(address: Address): void {
    this.editingId = address.id;
    this.isEditing = true;
    const { id, ...rest } = address;
    this.form = { ...rest };
    this.formError = null;
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

  // Search a place or drop a pin, and city/state/pincode/the map coords fill in from it --
  // house no., landmark, name and phone still need typing, same as "Use my current location".
  onLocationPicked(loc: PickedLocation): void {
    this.form.address_line = loc.address_line;
    this.form.city = loc.city;
    this.form.state = loc.state;
    this.form.pincode = loc.pincode;
    this.form.latitude = loc.latitude;
    this.form.longitude = loc.longitude;
    this.showLocationPicker = false;
  }

  save(): void {
    this.formError = null;
    if (!/^\d{10}$/.test(this.form.contact_phone.trim())) {
      this.formError = 'Enter a valid 10-digit phone number.';
      return;
    }
    if (!/^\d{6}$/.test(this.form.pincode.trim())) {
      this.formError = 'Enter a valid 6-digit pincode.';
      return;
    }
    // Without a pin, delivery charge/serviceability checks fail later at checkout with no clue
    // why -- catching it here, where "Use my current location" is right above, is the actual fix
    // rather than a cryptic error three screens later.
    if (this.form.latitude == null || this.form.longitude == null) {
      this.formError = 'Tap "Use my current location" to set this address\'s map pin before saving.';
      return;
    }

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
