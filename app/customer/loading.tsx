export default function CustomerLoading() {
  return (
    <div className="w-full p-6 animate-pulse space-y-4" aria-busy="true">
      <div className="h-7 w-48 rounded-lg bg-[#E8EAED]" />
      <div className="h-4 w-72 max-w-full rounded-md bg-[#E8EAED]/70" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-28 rounded-xl bg-[#E8EAED]" />
        ))}
      </div>
    </div>
  );
}
