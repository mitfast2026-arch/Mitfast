export interface ServiceItem {
  id: string;
  number: string;
  tag: string;
  title: string;
  description: string;
  ctaText: string;
  ctaHref: string;
}

export const SERVICES: ServiceItem[] = [
  {
    id: 'sourcing-development',
    number: '01',
    tag: 'SOURCING DEVELOPMENT',
    title: 'Sourcing Development',
    description:
      'You have a product design ready for production — we connect you with verified precision manufacturers with certified capacity to bring it to life.',
    ctaText: 'Learn More',
    ctaHref: '/enquiry?type=sourcing',
  },
  {
    id: 'procurement-service',
    number: '02',
    tag: 'OFF-CATALOG PROCUREMENT',
    title: 'Procurement Service',
    description:
      'Looking for a specialized product or material not listed in our catalog? We source verified suppliers and negotiate factory-direct terms.',
    ctaText: 'Learn More',
    ctaHref: '/enquiry?type=procurement',
  },
  {
    id: 'quote-product',
    number: '03',
    tag: 'MARKETPLACE PRICING',
    title: 'Quote for Product',
    description:
      'Request high-volume competitive pricing and locked production batches for fasteners, CNC parts, or hydraulic hardware listed on the Mitfast marketplace.',
    ctaText: 'Learn More',
    ctaHref: '/products',
  },
  {
    id: 'quote-dispatch',
    number: '04',
    tag: 'DELIVERY & SHIPPING',
    title: 'Delivery Quote',
    description:
      'Get delivery schedules and shipping quotes for confirmed bulk orders and export deliveries.',
    ctaText: 'Learn More',
    ctaHref: '/enquiry?type=dispatch',
  },
];

export interface TestimonialItem {
  name: string;
  role: string;
  company: string;
  quote: string;
  /** Optional photo URL; empty string uses initials avatar (avoids 404s). */
  photo: string;
  rating: number;
  relativeDate: string;
}

export const TESTIMONIALS: TestimonialItem[] = [
  {
    name: 'Kavita Menon',
    role: 'Head of Procurement',
    company: 'AeroForge Pune',
    quote:
      'MITFAST cut our fastener procurement lead time from twelve weeks to five. Every lot arrives with CMM dimensional reports and factory chemical certs intact.',
    photo: '',
    rating: 5,
    relativeDate: '1 week ago',
  },
  {
    name: 'Daniel Okonkwo',
    role: 'Procurement Manager',
    company: 'Helix Hydraulics',
    quote:
      'We run custom RFQs directly off CAD and 2D blueprints. The turnaround on locked pricing and guaranteed manufacturing windows is faster than any traditional broker.',
    photo: '',
    rating: 5,
    relativeDate: '2 weeks ago',
  },
  {
    name: 'Mei-Ling Zhou',
    role: 'Materials Manager',
    company: 'Pacific Precision',
    quote:
      'The catalog reflects real tier-one factory capacity, not brokered inventory. What we configure in the RFQ is exactly what lands on our inspection dock.',
    photo: '',
    rating: 5,
    relativeDate: '3 weeks ago',
  },
  {
    name: 'Elena Rodriguez',
    role: 'Director of Procurement',
    company: 'AeroDynamics Global',
    quote:
      'The ability to trace material certs directly from the invoice has simplified our compliance audits. MITFAST serves as our single source of truth.',
    photo: '',
    rating: 5,
    relativeDate: '1 month ago',
  },
  {
    name: 'Marcus Chen',
    role: 'Lead Manufacturing Engineer',
    company: 'Velocity Systems',
    quote:
      'Lead times on custom CNC turned parts dropped significantly once we centralized our orders through their RFQ cart.',
    photo: '',
    rating: 5,
    relativeDate: '1 month ago',
  },
  {
    name: 'Sarah Jenkins',
    role: 'QA / Compliance Manager',
    company: 'Horizon Aerospace',
    quote:
      'We require AS9100D compliance on all flight hardware. The digital documentation trail and CMM inspection reports match our strict standards.',
    photo: '',
    rating: 5,
    relativeDate: '2 months ago',
  },
];
