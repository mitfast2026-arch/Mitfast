import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Enquiry | MITFAST',
  description:
    'Send MITFAST a sourcing, procurement, or custom specification enquiry.',
};

export default function EnquiryLayout({ children }: { children: React.ReactNode }) {
  return children;
}
