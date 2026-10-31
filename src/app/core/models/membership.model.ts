export enum MembershipStatus {
  Pending = 1,
  Approved = 2,
  Rejected = 3,
  Removed = 5
}

export interface MyOrgMembership {
  id: number;
  org_name: string;
  banner_image: string | null;
  logo: string | null;
  city: string | null;
  state: string | null;
  is_verified: boolean;
  membership_status: MembershipStatus;
  joined_at: string;
  role_key: string;
  role_name: string;
  // Only present on /my/orgs (not the shape redeemCode's tap() synthesizes) -- module_keys needs
  // 'super_mart' and store_code needs to be non-null for this membership to double as a web
  // ordering storefront the landing page can jump straight back into.
  module_keys?: string[];
  store_code?: string | null;
}

export interface RedeemCodeResponse {
  org_id: number;
  org_name: string;
  role_name: string;
  membership_status: MembershipStatus;
  already_member: boolean;
  event: unknown | null;
}
