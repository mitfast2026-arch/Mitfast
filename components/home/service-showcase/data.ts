import { Anchor, Cpu, Layers, ShieldCheck, type LucideIcon } from 'lucide-react';

export interface ServiceShowcaseItem {
  id: string;
  number: string;
  tag: string;
  title: string;
  subtitle: string;
  category: string;
  badge: string;
  description: string;
  ctaText: string;
  ctaHref: string;
  image: string;
  objectPosition: string;
  icon: LucideIcon;
}

export const SERVICE_SHOWCASE_HEADLINE = {
  eyebrow: 'OUR SERVICES',
  title: 'Industrial Precision.',
  titleAccent: 'Global Velocity.',
  titleLine2: 'Engineered For Scale.',
  subtitle:
    'Direct access to AS9100D and ISO 9001 certified manufacturing floors. From custom 5-axis CNC machining and titanium fasteners to end-to-end container dispatch, we eliminate procurement friction.',
};

export const serviceShowcaseItems: ServiceShowcaseItem[] = [
  {
    id: 'sourcing-development',
    number: '01',
    tag: 'SOURCING DEVELOPMENT',
    title: 'Sourcing Development',
    subtitle: 'Bespoke CNC & Precision Tooling',
    category: 'Custom Fabrication',
    badge: 'ISO 9001:2015',
    description:
      'You have a product design ready for production — we connect you with verified precision manufacturers with certified capacity to bring it to life.',
    ctaText: 'Learn More',
    ctaHref: '/enquiry?type=sourcing',
    image: '/IMAGE/sourcing_development.jpg',
    objectPosition: 'center',
    icon: Cpu,
  },
  {
    id: 'procurement-service',
    number: '02',
    tag: 'OFF-CATALOG PROCUREMENT',
    title: 'Procurement Service',
    subtitle: 'Automated RFQ & Cert Tracking',
    category: 'B2B Enterprise',
    badge: 'AS9100D Traceable',
    description:
      'Looking for a specialized component or raw material specification not listed in our catalog? We source accredited suppliers and negotiate factory-direct terms.',
    ctaText: 'Learn More',
    ctaHref: '/enquiry?type=procurement',
    image: '/IMAGE/procurement_service.jpg',
    objectPosition: 'center 35%',
    icon: Layers,
  },
  {
    id: 'quote-product',
    number: '03',
    tag: 'CATALOG PRICING',
    title: 'Quote for Product',
    subtitle: 'Aerospace Fasteners & Valves',
    category: 'Instant Pricing',
    badge: 'Tiered Bulk Bids',
    description:
      'Request high-volume competitive pricing and locked production batches for fasteners, CNC parts, or hydraulic hardware listed in the Mitfast B2B catalog.',
    ctaText: 'Learn More',
    ctaHref: '/products',
    image: '/IMAGE/quote_product.jpg',
    objectPosition: 'center',
    icon: ShieldCheck,
  },
  {
    id: 'quote-dispatch',
    number: '04',
    tag: 'FREIGHT & LOGISTICS',
    title: 'Quote for Dispatch',
    subtitle: 'Container & Air Cargo Priority',
    category: 'Global Freight',
    badge: '99.8% On-Time',
    description:
      'Get transparent freight schedules, customs clearance guarantees, and door-to-port logistics quotes for scheduled batch deliveries and international container cargo.',
    ctaText: 'Learn More',
    ctaHref: '/enquiry?type=dispatch',
    image: '/IMAGE/quote_dispatch.jpg',
    objectPosition: 'center 70%',
    icon: Anchor,
  },
];
