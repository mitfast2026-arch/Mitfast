import Link from 'next/link';

export default function TermsPage() {
  return (
    <div className="container-custom py-12 max-w-3xl space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-mono uppercase tracking-widest text-[#6B7280]">Legal</p>
        <h1 className="type-page">Terms of use</h1>
        <p className="type-subtitle">
          These terms govern use of the MITFAST B2B procurement platform for industrial
          fastener and precision product listings.
        </p>
      </div>

      <div className="saas-panel p-6 space-y-4 text-sm text-[#374151] leading-relaxed">
        <section className="space-y-2">
          <h2 className="type-section text-[#111315]">1. Platform purpose</h2>
          <p>
            MITFAST provides catalog browsing, enquiries, RFQs, and order coordination between
            buyers, suppliers, and platform administrators. Commercial terms for individual
            transactions are confirmed through quotations and purchase documentation.
          </p>
        </section>
        <section className="space-y-2">
          <h2 className="type-section text-[#111315]">2. Accounts</h2>
          <p>
            You are responsible for accurate registration details and for safeguarding login
            credentials. Supplier accounts require admin approval before account access.
          </p>
        </section>
        <section className="space-y-2">
          <h2 className="type-section text-[#111315]">3. Catalog and pricing</h2>
          <p>
            Product information, MOQ, and pricing may change. Published catalog values are
            indicative until confirmed in an accepted RFQ or order.
          </p>
        </section>
        <section className="space-y-2">
          <h2 className="type-section text-[#111315]">4. Acceptable use</h2>
          <p>
            You may not misuse the platform, attempt unauthorized access, scrape protected data,
            or submit fraudulent enquiries or documents.
          </p>
        </section>
        <section className="space-y-2">
          <h2 className="type-section text-[#111315]">5. Contact</h2>
          <p>
            For terms questions, contact MITFAST operations through the enquiry or support
            channels published on the site.
          </p>
        </section>
      </div>

      <Link href="/" className="saas-btn-ghost text-xs inline-flex">
        Back to home
      </Link>
    </div>
  );
}
