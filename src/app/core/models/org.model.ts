export type OrgResolveReason = 'not_found' | 'inactive' | 'code_exhausted' | 'mart_disabled';

export interface OrgSummary {
  id: number;
  name: string;
  logo: string | null;
}

export interface OrgResolveValid {
  valid: true;
  code: string;
  org: OrgSummary;
  access_enabled: boolean;
  cod_enabled: boolean;
  online_payment_enabled: boolean;
}

export interface OrgResolveInvalid {
  valid: false;
  reason: OrgResolveReason;
}

export type OrgResolveResponse = OrgResolveValid | OrgResolveInvalid;
