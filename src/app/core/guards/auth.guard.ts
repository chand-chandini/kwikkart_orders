import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../services/auth.service';

// Requires an existing session. Org scope comes from the parent /o/:code segment, which this
// guard reaches via the activated route tree so refresh/direct-nav keep working.
export const authGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) {
    return true;
  }

  const code = route.parent?.paramMap.get('code') ?? state.url.match(/\/o\/([^/]+)/)?.[1];
  if (!code) {
    return router.createUrlTree(['/']);
  }

  return router.createUrlTree(['/o', code, 'auth', 'mobile'], { queryParams: { returnUrl: state.url } });
};
