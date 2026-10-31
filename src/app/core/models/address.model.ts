export interface Address {
  id: number;
  contact_name: string;
  contact_phone: string;
  address_line: string;
  city: string;
  state: string;
  pincode: string;
  house_no: string | null;
  landmark: string | null;
  label: string | null;
  latitude: number | null;
  longitude: number | null;
  is_default: boolean;
}

export type AddressPayload = Omit<Address, 'id'>;

// What app-location-picker-modal emits once a spot on the map is confirmed -- a subset of
// AddressPayload the map can actually derive (house_no/landmark/contact details/label still need
// the person to type them).
export interface PickedLocation {
  address_line: string;
  city: string;
  state: string;
  pincode: string;
  latitude: number;
  longitude: number;
}
