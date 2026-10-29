import { HttpClient } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { Observable, map, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import { CompleteProfilePayload, UpdateProfilePayload, User, VerifyOtpResponse } from '../models/user.model';
import { MembershipStatus, MyOrgMembership, RedeemCodeResponse } from '../models/membership.model';

const TOKEN_KEY = 'kk_token';
const USER_KEY = 'kk_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly currentUser = signal<User | null>(this.readStoredUser());
  readonly membershipByOrgId = new Map<number, MyOrgMembership | null>();

  constructor(private http: HttpClient) {}

  private readStoredUser(): User | null {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  sendOtp(mobile: string): Observable<{ message: string }> {
    return this.http
      .post<{ message: string }>(`${environment.apiBaseUrl}/auth/send_otp`, { mobile });
  }

  verifyOtp(mobile: string, otp: string): Observable<VerifyOtpResponse> {
    return this.http
      .post<{ data: VerifyOtpResponse }>(`${environment.apiBaseUrl}/auth/verify_otp`, { mobile, otp })
      .pipe(
        map((res) => res.data),
        tap((data) => this.persistSession(data))
      );
  }

  completeProfile(payload: CompleteProfilePayload): Observable<User> {
    return this.http
      .post<{ data: { user: User } }>(`${environment.apiBaseUrl}/auth/complete_profile`, payload)
      .pipe(
        map((res) => res.data.user),
        tap((user) => this.persistUser(user))
      );
  }

  fetchMe(): Observable<User> {
    return this.http.get<{ data: { user: User } }>(`${environment.apiBaseUrl}/auth/me`).pipe(
      map((res) => res.data.user),
      tap((user) => this.persistUser(user))
    );
  }

  updateProfile(payload: UpdateProfilePayload): Observable<User> {
    return this.http.put<{ data: { user: User } }>(`${environment.apiBaseUrl}/auth/profile`, payload).pipe(
      map((res) => res.data.user),
      tap((user) => this.persistUser(user))
    );
  }

  checkMembership(orgId: number): Observable<MyOrgMembership | null> {
    return this.http
      .get<{ data: { orgs: MyOrgMembership[] } }>(`${environment.apiBaseUrl}/my/orgs`)
      .pipe(
        map((res) => res.data.orgs.find((o) => o.id === orgId) ?? null),
        tap((membership) => this.membershipByOrgId.set(orgId, membership))
      );
  }

  redeemCode(code: string): Observable<RedeemCodeResponse> {
    return this.http
      .post<{ data: RedeemCodeResponse }>(`${environment.apiBaseUrl}/roles/redeem`, { code })
      .pipe(
        map((res) => res.data),
        tap((data) =>
          this.membershipByOrgId.set(data.org_id, {
            id: data.org_id,
            org_name: data.org_name,
            banner_image: null,
            logo: null,
            city: null,
            state: null,
            is_verified: false,
            membership_status: data.membership_status,
            joined_at: new Date().toISOString(),
            role_key: 'member',
            role_name: data.role_name
          })
        )
      );
  }

  getCachedMembership(orgId: number): MyOrgMembership | null | undefined {
    return this.membershipByOrgId.get(orgId);
  }

  isMembershipApproved(orgId: number): boolean {
    return this.membershipByOrgId.get(orgId)?.membership_status === MembershipStatus.Approved;
  }

  private persistSession(data: VerifyOtpResponse): void {
    localStorage.setItem(TOKEN_KEY, data.token);
    this.persistUser(data.user);
  }

  private persistUser(user: User): void {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    this.currentUser.set(user);
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.currentUser.set(null);
    this.membershipByOrgId.clear();
  }
}
