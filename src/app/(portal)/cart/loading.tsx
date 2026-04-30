export default function CartLoading() {
  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/30 flex flex-col">
      <div className="max-w-[900px] w-full mx-auto px-4 md:px-8 pt-12 pb-24">
        {/* Header skeleton */}
        <div className="mb-8">
          <div className="h-7 w-32 bg-slate-200 rounded animate-pulse" />
        </div>

        {/* Cart items skeleton */}
        <div className="space-y-3 mb-8">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 flex gap-4">
              <div className="h-16 w-16 bg-slate-200 rounded-lg animate-pulse flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-2/3 bg-slate-200 rounded animate-pulse" />
                <div className="h-3 w-1/3 bg-slate-200 rounded animate-pulse" />
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="h-4 w-16 bg-slate-200 rounded animate-pulse" />
                <div className="h-8 w-24 bg-slate-200 rounded-lg animate-pulse" />
              </div>
            </div>
          ))}
        </div>

        {/* Summary skeleton */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-3">
          <div className="flex justify-between">
            <div className="h-4 w-20 bg-slate-200 rounded animate-pulse" />
            <div className="h-4 w-24 bg-slate-200 rounded animate-pulse" />
          </div>
          <div className="flex justify-between">
            <div className="h-4 w-12 bg-slate-200 rounded animate-pulse" />
            <div className="h-4 w-20 bg-slate-200 rounded animate-pulse" />
          </div>
          <div className="border-t border-slate-100 pt-3 flex justify-between">
            <div className="h-5 w-16 bg-slate-200 rounded animate-pulse" />
            <div className="h-5 w-28 bg-slate-200 rounded animate-pulse" />
          </div>
          <div className="h-12 w-full bg-slate-200 rounded-lg animate-pulse mt-4" />
        </div>
      </div>
    </div>
  );
}
