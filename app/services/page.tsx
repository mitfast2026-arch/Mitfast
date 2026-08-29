import React from 'react';
import type { Metadata } from 'next';
import ServicesEnquiryGrid from '@/components/services/ServicesEnquiryGrid';

export const metadata: Metadata = {
  title: 'Services — MITFAST B2B Procurement',
  description:
    'Sourcing development, off-catalog procurement, and catalog pricing from AS9100D and ISO 9001 certified suppliers.',
};

export default function ServicesPage() {
  return <ServicesEnquiryGrid />;
}
