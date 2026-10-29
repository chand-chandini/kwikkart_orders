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
