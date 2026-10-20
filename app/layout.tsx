import type { Metadata } from 'next';
import './globals.css';
import { config } from '@/lib/config';
import { ConsentBanner } from '@/components/analytics/consent-banner';
import { GoogleAnalytics } from '@/components/analytics/google-analytics';
import { RouteTracker } from '@/components/analytics/route-tracker';
import { TopBar } from '@/components/layout/top-bar';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { Toaster } from '@/components/toaster';
import { CartDrawer } from '@/components/cart-drawer';
import { SessionBootstrap } from '@/components/session-bootstrap';

export const metadata: Metadata = {
  title: {
    default: config.storeName,
    template: `%s · ${config.storeName}`,
  },
  description: 'Tienda en línea de productos digitales y físicos.',
  icons: {
    icon: [
      {
        url: 'https://woocommerce-883512-3174482.cloudwaysapps.com/wp-content/uploads/2023/06/cropped-LOGO_Morado-32x32.png',
        sizes: '32x32',
        type: 'image/png',
      },
      {
        url: 'https://woocommerce-883512-3174482.cloudwaysapps.com/wp-content/uploads/2023/06/cropped-LOGO_Morado-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
    ],
  },
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
