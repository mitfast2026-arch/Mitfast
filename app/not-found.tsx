import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-16">
      <div className="max-w-md w-full text-center space-y-4">
        <p className="text-xs font-mono uppercase tracking-widest text-[#6B7280]">404</p>
        <h1 className="type-page text-xl">Page not found</h1>
        <p className="type-subtitle">
          The page you requested does not exist or is no longer available.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Link href="/" className="saas-btn-primary text-xs">
            Back to home
          </Link>
          <Link href="/products" className="saas-btn-secondary text-xs">
            Browse catalog
          </Link>
        </div>
      </div>
    </div>
  );
}
