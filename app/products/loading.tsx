export default function ProductsLoading() {
  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-10 animate-pulse" aria-busy="true">
      <div className="h-8 w-48 bg-[#E8EAED] rounded mb-6" />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="aspect-[4/5] rounded-xl bg-[#E8EAED]" />
        ))}
      </div>
    </div>
  );
}
