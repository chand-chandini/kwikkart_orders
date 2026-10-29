import { HttpClient } from '@angular/common/http';
import { Injectable, computed, signal } from '@angular/core';
import { Observable, map, of, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import { OrgResolveResponse } from '../models/org.model';

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
      })
    );
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
