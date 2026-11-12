export type ApiErrorCode =
  | 'out_of_stock'
  | 'insufficient_stock'
  | 'unavailable'
  | 'address_location_required'
  | 'not_serviceable'
  | 'coupon_invalid'
  | 'role_mismatch';

export interface AppError {
  status: number;
  message: string;
  code?: ApiErrorCode | string;
  raw?: unknown;
}
