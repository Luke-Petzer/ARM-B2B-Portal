export default function OrdersLoading() {
  return (
    <div className="flex-1 overflow-y-auto bg-[#fcfcfc]">
      <main className="max-w-[1200px] w-full mx-auto px-4 md:px-8 pt-12 pb-24">
        {/* Header skeleton */}
        <div className="mb-8">
          <div className="h-7 w-40 bg-slate-200 rounded animate-pulse" />
        </div>

        {/* Table skeleton */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Table header */}
          <div className="border-b border-slate-100 px-6 py-4 flex gap-8">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-3 w-20 bg-slate-200 rounded animate-pulse" />
            ))}
          </div>
          {/* Table rows */}
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="px-6 py-4 flex gap-8 border-b border-slate-50">
              <div className="h-4 w-24 bg-slate-200 rounded animate-pulse" />
              <div className="h-4 w-28 bg-slate-200 rounded animate-pulse" />
              <div className="h-4 w-16 bg-slate-200 rounded animate-pulse" />
              <div className="h-4 w-20 bg-slate-200 rounded animate-pulse" />
              <div className="h-6 w-16 bg-slate-200 rounded-full animate-pulse" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
