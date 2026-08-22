import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <div className="container-custom py-12 max-w-3xl space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-mono uppercase tracking-widest text-[#6B7280]">Legal</p>
        <h1 className="type-page">Privacy policy</h1>
        <p className="type-subtitle">
          How MITFAST handles account, enquiry, RFQ, and order information on this platform.
        </p>
      </div>

      <div className="saas-panel p-6 space-y-4 text-sm text-[#374151] leading-relaxed">
        <section className="space-y-2">
          <h2 className="type-section text-[#111315]">1. Data we collect</h2>
          <p>
            We collect account profile data, company and contact details, delivery addresses,
            product enquiries, RFQ/order records, and technical logs needed to operate the
            service securely.
          </p>
        </section>
        <section className="space-y-2">
          <h2 className="type-section text-[#111315]">2. How we use data</h2>
          <p>
            Data is used to authenticate users, process enquiries and RFQs, coordinate orders
            between buyers and suppliers, and improve platform reliability and security.
          </p>
        </section>
        <section className="space-y-2">
          <h2 className="type-section text-[#111315]">3. Sharing</h2>
          <p>
            Relevant transaction details may be shared with the supplier or buyer parties needed
            to fulfill an enquiry, RFQ, or order. We do not sell personal data.
          </p>
        </section>
        <section className="space-y-2">
          <h2 className="type-section text-[#111315]">4. Retention and security</h2>
          <p>
            Records are retained for operational, legal, and audit needs. Access is restricted by
            role and protected with authentication controls.
          </p>
        </section>
        <section className="space-y-2">
          <h2 className="type-section text-[#111315]">5. Contact</h2>
          <p>
            For privacy requests, contact MITFAST through the published support or enquiry
            channels.
          </p>
        </section>
      </div>

      <Link href="/" className="saas-btn-ghost text-xs inline-flex">
        Back to home
      </Link>
    </div>
  );
}
