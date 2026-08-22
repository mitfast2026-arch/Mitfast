import type { Metadata } from 'next';
import { Inter, Instrument_Sans, Chivo_Mono } from 'next/font/google';
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

const chivoMono = Chivo_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-chivo-mono',
  display: 'swap',
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  title: 'MITFAST — Industrial Fasteners & Precision Engineering B2B Platform',
  description: 'Enterprise B2B digital procurement platform for precision CNC turned parts, aerospace titanium fasteners, hydraulic couplings, and custom engineered components.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${instrumentSans.variable} ${chivoMono.variable}`}
    >
      <body className={`${inter.className} min-h-screen bg-white text-[#111315] antialiased`}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
