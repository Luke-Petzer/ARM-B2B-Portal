export default function DashboardLoading() {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 pt-6 pb-24">
        {/* Search bar skeleton */}
        <div className="h-10 w-full max-w-md bg-slate-200 rounded-lg animate-pulse mb-6" />

        {/* Category tabs skeleton */}
        <div className="flex gap-3 mb-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-8 w-20 bg-slate-200 rounded-full animate-pulse" />
          ))}
        </div>

        {/* Product grid skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
              <div className="h-40 bg-slate-200 rounded-lg animate-pulse" />
              <div className="h-4 w-3/4 bg-slate-200 rounded animate-pulse" />
              <div className="h-4 w-1/2 bg-slate-200 rounded animate-pulse" />
              <div className="flex justify-between items-center">
                <div className="h-5 w-16 bg-slate-200 rounded animate-pulse" />
                <div className="h-9 w-20 bg-slate-200 rounded-lg animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
