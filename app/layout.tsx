import type { Metadata } from 'next';
import { Inter, Instrument_Sans } from 'next/font/google';
import './globals.css';
import AppShell from '@/components/layout/AppShell';
import { buildOrganizationJsonLd, buildWebSiteJsonLd, siteUrl } from '@/lib/seo/product-json-ld';
import { serializeJsonLd } from '@/lib/server/seo/json-ld';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
  adjustFontFallback: false,
});

const instrumentSans = Instrument_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-instrument',
  display: 'swap',
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: 'MITFAST — Industrial Fasteners & Precision Engineering B2B Platform',
    template: '%s | MITFAST',
  },
  description:
    'B2B marketplace for precision CNC turned parts, titanium fasteners, hydraulic couplings, and custom engineered products.',
  openGraph: {
    type: 'website',
    siteName: 'MITFAST',
    title: 'MITFAST — Industrial Fasteners & Precision Engineering B2B Platform',
    description:
      'B2B marketplace for precision CNC turned parts, titanium fasteners, hydraulic couplings, and custom engineered products.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MITFAST — Industrial Fasteners & Precision Engineering',
    description:
      'B2B marketplace for precision CNC turned parts, titanium fasteners, and custom engineered products.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const orgLd = buildOrganizationJsonLd();
  const siteLd = buildWebSiteJsonLd();

  return (
    <html
      lang="en"
      className={`${inter.variable} ${instrumentSans.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var m=localStorage.getItem('mitfast-portal-color-mode');document.documentElement.dataset.portalTheme=m==='light'?'light':'dark';}catch(e){document.documentElement.dataset.portalTheme='dark';}})();`,
          }}
        />
      </head>
      <body className={`${inter.className} min-h-screen bg-white text-[#111315] antialiased`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(orgLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(siteLd) }}
        />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
