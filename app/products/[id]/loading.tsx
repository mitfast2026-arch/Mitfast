export default function ProductDetailLoading() {
  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-10 animate-pulse" aria-busy="true">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="aspect-square rounded-xl bg-[#E8EAED]" />
        <div className="space-y-4">
          <div className="h-8 w-3/4 bg-[#E8EAED] rounded" />
          <div className="h-4 w-1/2 bg-[#E8EAED] rounded" />
          <div className="h-24 w-full bg-[#E8EAED] rounded" />
          <div className="h-12 w-40 bg-[#E8EAED] rounded" />
        </div>
      </div>
    </div>
  );
}
