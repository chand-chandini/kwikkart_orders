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
}

export interface RedeemCodeResponse {
  org_id: number;
  org_name: string;
  role_name: string;
  membership_status: MembershipStatus;
  already_member: boolean;
  event: unknown | null;
}
