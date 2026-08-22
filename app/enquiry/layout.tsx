import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Enquiry | MITFAST',
  description:
    'Send MITFAST a sourcing, procurement, dispatch, or custom specification enquiry. CAD drawings are reviewed under NDA.',
};

export default function EnquiryLayout({ children }: { children: React.ReactNode }) {
  return children;
}
