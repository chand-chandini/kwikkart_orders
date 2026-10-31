import { AfterViewInit, Component, ElementRef, EventEmitter, Input, OnDestroy, Output, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { GoogleMapsLoaderService } from '../../../core/services/google-maps-loader.service';
import { PickedLocation } from '../../../core/models/address.model';

// India's rough centroid -- the map opens here (zoomed way out) when the form has no coordinates
// yet, so "search or click anywhere" still lands somewhere sane instead of the Gulf of Guinea
// (Google Maps' own (0,0) default).
const INDIA_CENTER = { lat: 20.5937, lng: 78.9629 };

@Component({
  selector: 'app-location-picker-modal',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './location-picker-modal.component.html',
  styleUrl: './location-picker-modal.component.scss'
})
export class LocationPickerModalComponent implements AfterViewInit, OnDestroy {
  @Input() initialLat: number | null = null;
  @Input() initialLng: number | null = null;
  @Output() closed = new EventEmitter<void>();
  @Output() picked = new EventEmitter<PickedLocation>();

  // Not { static: true } -- both elements sit inside the @else (!loadError) branch of the
  // template, a conditional block, so they don't exist yet at the earlier point static queries
  // resolve. Reading them is still safe in ngAfterViewInit (after the maps-script await) since
  // by then Angular has already run its first change detection pass.
  @ViewChild('mapEl') private mapEl!: ElementRef<HTMLDivElement>;
  @ViewChild('searchInput') private searchInput!: ElementRef<HTMLInputElement>;

  private readonly mapsLoader = inject(GoogleMapsLoaderService);

  loading = true;
  loadError = false;
  loadErrorMessage = '';
  resolving = false;
  selected: PickedLocation | null = null;

  private map: any;
  private marker: any;
  private geocoder: any;
  private listeners: any[] = [];

  async ngAfterViewInit(): Promise<void> {
    try {
      await this.mapsLoader.load();
    } catch (err) {
      this.loading = false;
      this.loadError = true;
      this.loadErrorMessage = err instanceof Error ? err.message : 'Could not load Google Maps.';
      return;
    }

    const google = window.google;
    if (!google?.maps?.places) {
      this.loading = false;
      this.loadError = true;
      this.loadErrorMessage = 'Google Maps loaded without the Places library -- check the Places API is enabled on this key.';
      return;
    }
    this.geocoder = new google.maps.Geocoder();

    const hasInitial = this.initialLat != null && this.initialLng != null;
    const center = hasInitial ? { lat: this.initialLat!, lng: this.initialLng! } : INDIA_CENTER;

    this.map = new google.maps.Map(this.mapEl.nativeElement, {
      center,
      zoom: hasInitial ? 16 : 5,
      streetViewControl: false,
      mapTypeControl: false,
      fullscreenControl: false
    });

    this.marker = new google.maps.Marker({
      position: center,
      map: this.map,
      draggable: true
    });

    this.listeners.push(this.marker.addListener('dragend', () => this.reverseGeocode(this.marker.getPosition())));
    this.listeners.push(this.map.addListener('click', (e: any) => {
      this.marker.setPosition(e.latLng);
      this.reverseGeocode(e.latLng);
    }));

    const autocomplete = new google.maps.places.Autocomplete(this.searchInput.nativeElement, {
      componentRestrictions: { country: 'in' },
      fields: ['geometry', 'address_components', 'formatted_address']
    });
    this.listeners.push(autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      if (!place.geometry?.location) {
        return;
      }
      this.map.setCenter(place.geometry.location);
      this.map.setZoom(16);
      this.marker.setPosition(place.geometry.location);
      this.applyAddressComponents(place.address_components ?? [], place.formatted_address ?? '', place.geometry.location);
    }));

    this.loading = false;
    if (hasInitial) {
      this.reverseGeocode(this.marker.getPosition());
    }
  }

  ngOnDestroy(): void {
    this.listeners.forEach((l) => window.google?.maps?.event?.removeListener(l));
  }

  private reverseGeocode(latLng: any): void {
    this.resolving = true;
    this.geocoder.geocode({ location: latLng }, (results: any[], status: string) => {
      this.resolving = false;
      if (status !== 'OK' || !results?.length) {
        return;
      }
      this.applyAddressComponents(results[0].address_components ?? [], results[0].formatted_address ?? '', latLng);
    });
  }

  private applyAddressComponents(components: Array<{ long_name: string; types: string[] }>, formattedAddress: string, latLng: any): void {
    const get = (type: string) => components.find((c) => c.types.includes(type))?.long_name ?? '';
    const city = get('locality') || get('administrative_area_level_2') || get('sublocality') || '';
    const state = get('administrative_area_level_1');
    const pincode = get('postal_code');
    const addressLine = [get('route'), get('sublocality_level_1') || get('sublocality')].filter(Boolean).join(', ') || formattedAddress;

    this.selected = {
      address_line: addressLine,
      city,
      state,
      pincode,
      latitude: typeof latLng.lat === 'function' ? latLng.lat() : latLng.lat,
      longitude: typeof latLng.lng === 'function' ? latLng.lng() : latLng.lng
    };
  }

  confirm(): void {
    if (this.selected) {
      this.picked.emit(this.selected);
    }
  }

  close(): void {
    this.closed.emit();
  }
}
