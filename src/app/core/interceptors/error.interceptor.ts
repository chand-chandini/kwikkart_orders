import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';
import { AppError } from '../models/api-error.model';

// Errors that components surface inline (validation state, retry UI) rather than as a toast —
// a global "out of stock" popup on top of an inline badge would just be noise.
const SILENT_CODES = new Set(['out_of_stock', 'insufficient_stock', 'address_location_required', 'not_serviceable']);

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const toast = inject(ToastService);

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      const body = err.error ?? {};
      // A 401 only means "the session died" when the request actually carried our token --
      // auth.interceptor only attaches one once a session exists. Pre-login calls like
      // verify_otp also answer 401 for a plain wrong code, which isn't a session problem at
      // all (there's no session yet), so treating every 401 as a forced logout+redirect wiped
      // the user back to the mobile-entry screen before they ever saw why.
      const hadSessionToken = req.headers.has('Authorization');

      if (err.status === 401 && hadSessionToken) {
        auth.logout();
        const orgCode = router.url.match(/\/o\/([^/]+)/)?.[1];
        if (orgCode) {
          router.navigate(['/o', orgCode, 'auth', 'mobile'], { queryParams: { returnUrl: router.url } });
        }
      }

      const appError: AppError = {
        status: err.status,
        message: body?.message ?? err.message ?? 'something went wrong',
        code: body?.code,
        raw: body
      };

      if (!(err.status === 401 && hadSessionToken) && !SILENT_CODES.has(String(appError.code))) {
        toast.error(appError.message);
      }

      return throwError(() => appError);
    })
  );
};
