import { HttpClient } from '@angular/common/http';
import { Injectable, computed, signal } from '@angular/core';
import { Observable, map, of, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import { OrgResolveResponse } from '../models/org.model';

// Last store code that resolved successfully, kept in localStorage (not just the in-memory
// `cache` below, which starts empty again on every fresh page load/session) so the landing
// page's store-code step can come back pre-filled next time instead of making a returning
// customer retype a code they already gave once.
const LAST_CODE_KEY = 'kk_last_org_code';

@Injectable({ providedIn: 'root' })
export class OrgContextService {
  private readonly cache = new Map<string, OrgResolveResponse>();

  private readonly currentCode = signal<string | null>(null);
  private readonly currentResult = signal<OrgResolveResponse | null>(null);
  readonly resolving = signal(false);

  readonly org = computed(() => {
    const result = this.currentResult();
    return result && result.valid ? result.org : null;
  });

  readonly accessFlags = computed(() => {
    const result = this.currentResult();
    if (!result || !result.valid) {
      return null;
    }
    return {
      access_enabled: result.access_enabled,
      cod_enabled: result.cod_enabled,
      online_payment_enabled: result.online_payment_enabled
    };
  });

  readonly invalidReason = computed(() => {
    const result = this.currentResult();
    return result && !result.valid ? result.reason : null;
  });

  constructor(private http: HttpClient) {}

  resolve(code: string): Observable<OrgResolveResponse> {
    const normalized = code.toUpperCase();

    if (this.currentCode() === normalized && this.currentResult()) {
      return of(this.currentResult()!);
    }

    const cached = this.cache.get(normalized);
    if (cached) {
      this.currentCode.set(normalized);
      this.currentResult.set(cached);
      return of(cached);
    }

    this.resolving.set(true);
    return this.http.get<{ data: OrgResolveResponse }>(`${environment.apiBaseUrl}/orgs/resolve/${normalized}`).pipe(
      map((res) => res.data),
      tap((result) => {
        this.cache.set(normalized, result);
        this.currentCode.set(normalized);
        this.currentResult.set(result);
        this.resolving.set(false);
        if (result.valid) {
          localStorage.setItem(LAST_CODE_KEY, normalized);
        }
      })
    );
  }

  getLastCode(): string | null {
    return localStorage.getItem(LAST_CODE_KEY);
  }

  getOrgId(): number | null {
    return this.org()?.id ?? null;
  }

  requireOrgId(): number {
    const id = this.getOrgId();
    if (id == null) {
      throw new Error('OrgContextService.requireOrgId called before an org was resolved');
    }
    return id;
  }

  getCurrentCode(): string | null {
    return this.currentCode();
  }

  clear(): void {
    this.currentCode.set(null);
    this.currentResult.set(null);
  }
}
