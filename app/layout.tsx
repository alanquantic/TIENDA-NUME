import type { Metadata } from 'next';
import './globals.css';
import { config } from '@/lib/config';
import { TopBar } from '@/components/layout/top-bar';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { Toaster } from '@/components/toaster';

export const metadata: Metadata = {
  title: {
    default: config.storeName,
    template: `%s · ${config.storeName}`,
  },
  description: 'Tienda en línea de productos digitales y físicos.',
};

// Fija el tema antes del primer paint para evitar parpadeo.
const themeScript = `(function(){try{var t=localStorage.getItem('theme');if(t!=='dark'&&t!=='light'){t=(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light';}document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen flex flex-col">
        <TopBar />
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
        <Toaster />
      </body>
    </html>
  );
}
