import { Routes } from '@angular/router';

import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'o/:code',
    loadComponent: () => import('./features/org-shell/org-shell.component').then((m) => m.OrgShellComponent),
    children: [
      // Every catalog endpoint requires auth.required server-side (shopOrgOr403 needs req.user.id
      // to check membership) — there's no public/guest browsing. Without this guard, a signed-out
      // visitor would land on these routes, the first API call would 401, and they'd get silently
      // bounced to login mid-fetch with nothing rendered — looking exactly like "doesn't work"
      // rather than "please sign in". Guarding here front-loads that redirect before any fetch.
      { path: '', loadComponent: () => import('./features/catalog/home/home.component').then((m) => m.HomeComponent), canActivate: [authGuard] },
      { path: 'search', loadComponent: () => import('./features/catalog/search/search.component').then((m) => m.SearchComponent), canActivate: [authGuard] },
      { path: 'c/:categoryId', loadComponent: () => import('./features/catalog/category/category.component').then((m) => m.CategoryComponent), canActivate: [authGuard] },
      { path: 'p/:productId', loadComponent: () => import('./features/catalog/product-detail/product-detail.component').then((m) => m.ProductDetailComponent), canActivate: [authGuard] },

      { path: 'auth/mobile', loadComponent: () => import('./features/auth/mobile-entry/mobile-entry.component').then((m) => m.MobileEntryComponent) },
      { path: 'auth/otp', loadComponent: () => import('./features/auth/otp-verify/otp-verify.component').then((m) => m.OtpVerifyComponent) },
      { path: 'auth/profile', loadComponent: () => import('./features/auth/complete-profile/complete-profile.component').then((m) => m.CompleteProfileComponent), canActivate: [authGuard] },

      { path: 'cart', loadComponent: () => import('./features/cart/cart.component').then((m) => m.CartComponent), canActivate: [authGuard] },
      { path: 'checkout', loadComponent: () => import('./features/checkout/checkout.component').then((m) => m.CheckoutComponent), canActivate: [authGuard] },
      { path: 'checkout/success/:orderId', loadComponent: () => import('./features/checkout/order-success/order-success.component').then((m) => m.OrderSuccessComponent), canActivate: [authGuard] },

      { path: 'orders', loadComponent: () => import('./features/orders/order-list/order-list.component').then((m) => m.OrderListComponent), canActivate: [authGuard] },
      { path: 'orders/:orderId', loadComponent: () => import('./features/orders/order-detail/order-detail.component').then((m) => m.OrderDetailComponent), canActivate: [authGuard] },

      { path: 'account', loadComponent: () => import('./features/account/profile/profile.component').then((m) => m.ProfileComponent), canActivate: [authGuard] },
      { path: 'account/addresses', loadComponent: () => import('./features/account/addresses/addresses.component').then((m) => m.AddressesComponent), canActivate: [authGuard] },

      { path: '**', loadComponent: () => import('./shared/components/not-found/not-found.component').then((m) => m.NotFoundComponent) }
    ]
  },
  { path: '', loadComponent: () => import('./features/landing/landing.component').then((m) => m.LandingComponent) },
  { path: '**', loadComponent: () => import('./shared/components/not-found/not-found.component').then((m) => m.NotFoundComponent) }
];
