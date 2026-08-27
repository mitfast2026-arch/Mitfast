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
  titleAccent: 'Factory Direct.',
  titleLine2: 'Built For Buyers.',
  subtitle:
    'Direct access to AS9100D and ISO 9001 certified suppliers. From custom CNC machining and titanium fasteners to bulk orders, we simplify B2B procurement.',
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
    image: '/images/sourcing_development.jpg',
    objectPosition: 'center',
    icon: Cpu,
  },
  {
    id: 'procurement-service',
    number: '02',
    tag: 'OFF-CATALOG PROCUREMENT',
    title: 'Procurement Service',
    subtitle: 'Automated RFQ & Cert Tracking',
    category: 'B2B Marketplace',
    badge: 'AS9100D Traceable',
    description:
      'Looking for a specialized product or material not listed in our catalog? We source verified suppliers and negotiate factory-direct terms.',
    ctaText: 'Learn More',
    ctaHref: '/enquiry?type=procurement',
    image: '/images/procurement_service.jpg',
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
    image: '/images/quote_product.jpg',
    objectPosition: 'center',
    icon: ShieldCheck,
  },
  {
    id: 'quote-dispatch',
    number: '04',
    tag: 'DELIVERY & SHIPPING',
    title: 'Delivery Quote',
    subtitle: 'Bulk & Export Orders',
    category: 'Order Delivery',
    badge: '99.8% On-Time',
    description:
      'Get delivery schedules and shipping quotes for confirmed bulk orders, export deliveries, and scheduled batches.',
    ctaText: 'Learn More',
    ctaHref: '/enquiry?type=dispatch',
    image: '/images/quote_dispatch.jpg',
    objectPosition: 'center 70%',
    icon: Anchor,
  },
];
