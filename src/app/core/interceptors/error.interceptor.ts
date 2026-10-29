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

      if (err.status === 401) {
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

      if (err.status !== 401 && !SILENT_CODES.has(String(appError.code))) {
        toast.error(appError.message);
      }

      return throwError(() => appError);
    })
  );
};
