// Centralised branding so the logo/colors can be swapped (prod asset drop-in, theme change)
// without touching components. Theme colors also live as CSS vars in styles.scss — keep both
// in sync if you change them here.
export const BRANDING = {
  appName: 'Kwikkart',
  logoUrl: 'assets/logo.png',
  faviconUrl: 'assets/favicon.png',
  supportEmail: 'support@kwikkart.in',
  supportPhone: '',
  colors: {
    primary: '#1a7f3c',
    primaryDark: '#125c2b',
    secondary: '#ff8c00',
    accent: '#ffb020'
  }
};
