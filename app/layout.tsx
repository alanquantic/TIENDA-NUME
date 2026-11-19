import type { Metadata } from 'next';
import './globals.css';
import { ConsentBanner } from '@/components/analytics/consent-banner';
import { GoogleAnalytics } from '@/components/analytics/google-analytics';
import { RouteTracker } from '@/components/analytics/route-tracker';
import { TopBar } from '@/components/layout/top-bar';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { Toaster } from '@/components/toaster';
import { CartDrawer } from '@/components/cart-drawer';
import { SessionBootstrap } from '@/components/session-bootstrap';
import { config } from '@/lib/config';
import { SITE_BRAND, SITE_DESCRIPTION, SITE_OG_IMAGE_PATH, SITE_TITLE } from '@/lib/site';

// Códigos de verificación opcionales (Search Console y dominio de Meta). Se
// configuran en Vercel sin tocar código.
const googleVerification = process.env.GOOGLE_SITE_VERIFICATION?.trim();
const metaDomainVerification = process.env.META_DOMAIN_VERIFICATION?.trim();

export const metadata: Metadata = {
  // Base para volver absolutas las URLs de canonical, og:image, etc.
  metadataBase: new URL(config.appUrl),
  title: {
    // Mismo título y formato "Página – Sitio" que la tienda anterior (WooCommerce).
    default: SITE_TITLE,
    template: `%s – ${SITE_TITLE}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_BRAND,
  openGraph: {
    type: 'website',
    locale: 'es_MX',
    siteName: SITE_TITLE,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [{ url: SITE_OG_IMAGE_PATH, width: 1200, height: 630, alt: SITE_TITLE }],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [SITE_OG_IMAGE_PATH],
  },
  ...(googleVerification || metaDomainVerification
    ? {
        verification: {
          ...(googleVerification ? { google: googleVerification } : {}),
          ...(metaDomainVerification
            ? { other: { 'facebook-domain-verification': metaDomainVerification } }
            : {}),
        },
      }
    : {}),
  // Favicon: app/icon.png y app/apple-icon.png (logo de numerologia-cotidiana.com).
};

// Fija el tema antes del primer paint para evitar parpadeo.
// Por defecto siempre arranca en claro; solo respeta la preferencia guardada
// si el usuario ha usado el toggle.
const themeScript = `(function(){try{var t=localStorage.getItem('theme');if(t!=='dark'&&t!=='light'){t='light';}document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','light');}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <GoogleAnalytics />
      </head>
      <body className="min-h-screen flex flex-col">
        <SessionBootstrap />
        <RouteTracker />
        <TopBar />
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
        <Toaster />
        <CartDrawer />
        <ConsentBanner />
      </body>
    </html>
  );
}
