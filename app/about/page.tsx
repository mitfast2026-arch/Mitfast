import type { Metadata } from 'next';
import About from '@/components/home/About';

export const metadata: Metadata = {
  title: 'About MITFAST | Industrial B2B Procurement',
  description:
    'Learn about MITFAST — sourcing, quality assurance, and supplier partnerships for industrial procurement.',
};

export default function AboutPage() {
  return <About />;
}
