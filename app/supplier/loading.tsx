export default function SupplierLoading() {
  return (
    <div className="space-y-6 w-full animate-pulse" aria-busy="true" aria-label="Loading">
      <div className="space-y-2">
        <div className="h-7 w-52 rounded-lg bg-portal-inset" />
        <div className="h-4 w-80 max-w-full rounded-md bg-portal-inset/70" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="saas-panel h-28 rounded-xl bg-portal-panel" />
        ))}
      </div>
      <div className="saas-panel h-64 rounded-xl bg-portal-panel" />
    </div>
  );
}
