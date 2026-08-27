/** Shared labels and helpers for Enquiry → RFQ → Order admin workflow */

export const ENQUIRY_TYPE_LABELS: Record<string, string> = {
  product: 'Product enquiry',
  contact: 'Contact us',
  custom: 'Send enquiry',
  sourcing: 'Sourcing',
  procurement: 'Procurement',
  dispatch: 'Delivery',
  cart: 'Cart RFQ',
  general: 'General',
};

export function enquiryTypeLabel(type?: string | null, hasProduct?: boolean): string {
  if (type && ENQUIRY_TYPE_LABELS[type]) return ENQUIRY_TYPE_LABELS[type];
  if (hasProduct) return ENQUIRY_TYPE_LABELS.product;
  return ENQUIRY_TYPE_LABELS.contact;
}

export function enquiryContact(row: {
  guest_name?: string;
  guest_email?: string;
  guest_phone?: string;
  country?: string | null;
  company_name?: string | null;
  customer?: { full_name?: string; email?: string; phone?: string } | null;
}) {
  return {
    name: row.customer?.full_name || row.guest_name || '—',
    email: row.customer?.email || row.guest_email || '—',
    phone: row.customer?.phone || row.guest_phone || '—',
    country: row.country || '—',
    company: row.company_name || null,
  };
}

export function rfqContact(rfq: {
  customer?: { full_name?: string; email?: string; phone?: string } | null;
  enquiry?: {
    guest_name?: string;
    guest_email?: string;
    guest_phone?: string;
    country?: string | null;
    company_name?: string | null;
  } | null;
  delivery_address_snapshot?: { country?: string } | null;
}) {
  const fromEnquiry = rfq.enquiry;
  return {
    name: rfq.customer?.full_name || fromEnquiry?.guest_name || '—',
    email: rfq.customer?.email || fromEnquiry?.guest_email || '—',
    phone: rfq.customer?.phone || fromEnquiry?.guest_phone || '—',
    country:
      fromEnquiry?.country ||
      rfq.delivery_address_snapshot?.country ||
      '—',
    company: fromEnquiry?.company_name || null,
  };
}

export function orderContact(order: {
  customer?: { full_name?: string; email?: string; phone?: string } | null;
  enquiry?: {
    guest_name?: string;
    guest_email?: string;
    guest_phone?: string;
    country?: string | null;
  } | null;
  delivery_address_snapshot?: {
    address_line_1?: string;
    address_line_2?: string | null;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
  } | null;
}) {
  const addr = order.delivery_address_snapshot;
  return {
    name: order.customer?.full_name || order.enquiry?.guest_name || '—',
    email: order.customer?.email || order.enquiry?.guest_email || '—',
    phone: order.customer?.phone || order.enquiry?.guest_phone || '—',
    country: addr?.country || order.enquiry?.country || '—',
    addressLine1: addr?.address_line_1 || '—',
    addressLine2: addr?.address_line_2 || null,
    city: addr?.city || '—',
    state: addr?.state || '—',
    postalCode: addr?.postal_code || '—',
  };
}

export function enquiryStatusBadgeClass(status: string): string {
  switch (status) {
    case 'new':
      return 'saas-badge-cyan';
    case 'contacted':
      return 'saas-badge-gold';
    case 'converted_to_rfq':
      return 'saas-badge-neutral';
    case 'converted_to_order':
      return 'saas-badge-success';
    case 'closed':
      return 'saas-badge-neutral';
    default:
      return 'saas-badge-neutral';
  }
}

export function rfqStatusBadgeClass(status: string): string {
  switch (status) {
    case 'accepted':
      return 'saas-badge-success';
    case 'converted_to_order':
      return 'saas-badge-cyan';
    case 'rejected':
      return 'saas-badge-danger';
    case 'under_review':
      return 'saas-badge-gold';
    default:
      return 'saas-badge-gold';
  }
}

export function orderStatusBadgeClass(status: string): string {
  switch (status) {
    case 'dispatched':
      return 'saas-badge-success';
    case 'cancelled':
      return 'saas-badge-danger';
    case 'packing':
      return 'saas-badge-gold';
    default:
      return 'saas-badge-gold';
  }
}

export function formatStatusLabel(status: string): string {
  return status.replace(/_/g, ' ').toUpperCase();
}
