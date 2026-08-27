import type { Metadata } from 'next';
import { Inter, Instrument_Sans } from 'next/font/google';
import './globals.css';
import AppShell from '@/components/layout/AppShell';

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
  title: 'MITFAST — Industrial Fasteners & Precision Engineering B2B Platform',
  description: 'B2B marketplace for precision CNC turned parts, titanium fasteners, hydraulic couplings, and custom engineered products.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${instrumentSans.variable}`}
    >
      <body className={`${inter.className} min-h-screen bg-white text-[#111315] antialiased`}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
