import { Injectable } from '@angular/core';

import { environment } from '../../../environments/environment';

// No @types/google.maps dependency -- the map/geocoder/places APIs are used loosely typed
// (`any`) rather than pulling in a typings package for what's a single small picker component.
declare global {
  interface Window {
    google?: any;
    gm_authFailure?: () => void;
  }
}

const SCRIPT_ID = 'kk-google-maps-script';

@Injectable({ providedIn: 'root' })
export class GoogleMapsLoaderService {
  private scriptLoaded: Promise<void> | null = null;

  // Idempotent and safe to call from multiple components that might mount around the same time
  // (e.g. the address form on account/addresses and on checkout) -- only the first call injects
  // the <script> tag; later calls either reuse the resolved promise or, if another call's tag is
  // still loading, poll window.google until it's ready instead of injecting a second tag.
  load(): Promise<void> {
    if (this.scriptLoaded) {
      return this.scriptLoaded;
    }
    this.scriptLoaded = new Promise((resolve, reject) => {
      if (window.google?.maps) {
        resolve();
        return;
      }
      if (document.getElementById(SCRIPT_ID)) {
        const poll = () => (window.google?.maps ? resolve() : setTimeout(poll, 50));
        poll();
        return;
      }
      // A bad/restricted key (wrong HTTP referrer allow-list, billing off, Maps JavaScript API
      // or Places API not enabled on the key) still lets the script itself download and fire its
      // own `onload` -- Google instead calls this global callback, asynchronously and not
      // necessarily before `onload`, and window.google.maps never actually initializes. That
      // leaves the map/search silently broken, which otherwise looks identical to "the search
      // just doesn't return anything". Racing the two below (reject wins if it fires first,
      // otherwise the poll resolves once maps genuinely shows up) surfaces it instead.
      window.gm_authFailure = () => reject(new Error(
        "Google Maps rejected this API key (check it's unrestricted for this domain and that the Maps JavaScript API + Places API are enabled and billed)."
      ));
      const script = document.createElement('script');
      script.id = SCRIPT_ID;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${environment.googleMapsApiKey}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        let attempts = 0;
        const poll = () => {
          if (window.google?.maps) {
            resolve();
          } else if (++attempts > 100) {
            reject(new Error('Google Maps did not finish loading.'));
          } else {
            setTimeout(poll, 50);
          }
        };
        poll();
      };
      script.onerror = () => reject(new Error('Could not load Google Maps.'));
      document.head.appendChild(script);
    });
    return this.scriptLoaded;
  }
}
