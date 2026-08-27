export default function CartLoading() {
  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-10 animate-pulse" aria-busy="true">
      <div className="h-8 w-40 bg-[#E8EAED] rounded mb-8" />
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-[#E8EAED]" />
        ))}
      </div>
    </div>
  );
}
