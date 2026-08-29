import { createAdminClient } from '@/lib/supabase/admin';
import { sendTransactionalEmail } from '@/lib/server/email/send-transactional-mail';

type SupplierPrefs = {
  emailRfqs?: boolean;
  emailOrders?: boolean;
  emailApprovals?: boolean;
};

function prefsAllow(prefs: SupplierPrefs | null | undefined, key: keyof SupplierPrefs): boolean {
  if (!prefs || typeof prefs !== 'object') return true;
  return prefs[key] !== false;
}

async function notifySupplier(
  supplierId: string,
  prefKey: 'emailRfqs' | 'emailOrders',
  subject: string,
  bodyHtml: string
): Promise<void> {
  const adminClient = createAdminClient();
  const { data: supplier } = await adminClient
    .from('suppliers')
    .select('email, company_name, notification_preferences, status')
    .eq('id', supplierId)
    .maybeSingle();

  if (!supplier?.email || supplier.status !== 'active') return;
  if (!prefsAllow(supplier.notification_preferences as SupplierPrefs, prefKey)) return;

  const html = `
    <div style="font-family:Segoe UI,system-ui,sans-serif;max-width:520px;margin:0 auto;padding:28px;background:#ffffff;border:1px solid #E5E7EB;border-radius:16px;">
      <p style="margin:0 0 4px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#6B7280;">MITFAST B2B</p>
      <h1 style="margin:0 0 12px;font-size:20px;color:#111315;">${subject}</h1>
      ${bodyHtml}
      <p style="margin:24px 0 0;font-size:12px;color:#9CA3AF;">Sign in to your supplier portal to review details.</p>
    </div>
  `;

  await sendTransactionalEmail({ to: supplier.email, subject, html });
  // Delivery failures are logged inside sendTransactionalEmail; notifications are best-effort.
}

export async function notifySuppliersForRfq(rfqId: string): Promise<void> {
  try {
    const adminClient = createAdminClient();
    const { data: rfq } = await adminClient
      .from('rfqs')
      .select('rfq_number, items:rfq_items(product:products(supplier_id))')
      .eq('id', rfqId)
      .maybeSingle();

    if (!rfq) return;

    const supplierIds = new Set<string>();
    for (const item of (rfq as any).items || []) {
      const sid = item?.product?.supplier_id;
      if (sid) supplierIds.add(sid);
    }

    const rfqNumber = (rfq as any).rfq_number || rfqId.slice(0, 8);
    await Promise.all(
      [...supplierIds].map((supplierId) =>
        notifySupplier(
          supplierId,
          'emailRfqs',
          `New RFQ ${rfqNumber}`,
          `<p style="margin:0;font-size:14px;line-height:1.5;color:#4B5563;">You have a new request for quote <strong>${rfqNumber}</strong>.</p>`
        )
      )
    );
  } catch (error) {
    console.error('[notifySuppliersForRfq]', error);
  }
}

export async function notifySuppliersForOrder(orderId: string): Promise<void> {
  try {
    const adminClient = createAdminClient();
    const { data: order } = await adminClient
      .from('orders')
      .select('order_number, items:order_items(supplier_id)')
      .eq('id', orderId)
      .maybeSingle();

    if (!order) return;

    const supplierIds = new Set<string>();
    for (const item of (order as any).items || []) {
      if (item?.supplier_id) supplierIds.add(item.supplier_id);
    }

    const orderNumber = (order as any).order_number || orderId.slice(0, 8);
    await Promise.all(
      [...supplierIds].map((supplierId) =>
        notifySupplier(
          supplierId,
          'emailOrders',
          `New order ${orderNumber}`,
          `<p style="margin:0;font-size:14px;line-height:1.5;color:#4B5563;">A new order <strong>${orderNumber}</strong> includes your products.</p>`
        )
      )
    );
  } catch (error) {
    console.error('[notifySuppliersForOrder]', error);
  }
}

export async function notifyAdminNewSupplierApplication(supplierId: string): Promise<void> {
  try {
    const adminClient = createAdminClient();
    const { data: supplier } = await adminClient
      .from('suppliers')
      .select('company_name, contact_person, email, phone, country')
      .eq('id', supplierId)
      .maybeSingle();

    if (!supplier) return;

    const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || process.env.RESEND_FROM_EMAIL || 'admin@mitfast.com';

    const subject = `New Supplier Application: ${supplier.company_name}`;
    const html = `
      <div style="font-family:Segoe UI,system-ui,sans-serif;max-width:560px;margin:0 auto;padding:28px;background:#ffffff;border:1px solid #E5E7EB;border-radius:16px;">
        <p style="margin:0 0 4px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#059669;font-weight:600;">MITFAST B2B PORTAL</p>
        <h1 style="margin:0 0 16px;font-size:20px;color:#111315;">New Supplier Application Pending Approval</h1>
        <p style="margin:0 0 16px;font-size:14px;color:#4B5563;">A new manufacturing supplier has completed onboarding and is waiting for your review:</p>
        <div style="background:#F9FAFB;padding:16px;border-radius:12px;border:1px solid #E5E7EB;margin-bottom:20px;">
          <p style="margin:0 0 8px;font-size:13px;color:#111827;"><strong>Company:</strong> ${supplier.company_name}</p>
          <p style="margin:0 0 8px;font-size:13px;color:#111827;"><strong>Contact Person:</strong> ${supplier.contact_person}</p>
          <p style="margin:0 0 8px;font-size:13px;color:#111827;"><strong>Email:</strong> ${supplier.email}</p>
          <p style="margin:0 0 8px;font-size:13px;color:#111827;"><strong>Phone:</strong> ${supplier.phone || 'N/A'}</p>
          <p style="margin:0;font-size:13px;color:#111827;"><strong>Country:</strong> ${supplier.country || 'N/A'}</p>
        </div>
        <p style="margin:0;font-size:13px;color:#6B7280;">Sign in to the Admin Portal under <strong>Approvals</strong> to accept or reject this application.</p>
      </div>
    `;

    await sendTransactionalEmail({ to: adminEmail, subject, html });
  } catch (error) {
    console.error('[notifyAdminNewSupplierApplication]', error);
  }
}

