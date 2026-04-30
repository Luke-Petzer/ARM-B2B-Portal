export default function DashboardLoading() {
  return (
    <>
      {/* Search bar */}
      <div className="bg-white border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center px-6 md:px-8 h-[40px]">
          <div className="h-4 w-4 bg-slate-200 rounded animate-pulse mr-3" />
          <div className="h-4 w-64 bg-slate-200 rounded animate-pulse" />
        </div>
      </div>

      <main className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Product list */}
        <section className="flex-1 overflow-y-auto">
          {/* Category pills skeleton */}
          <div className="sticky top-0 z-20 bg-white border-b border-gray-100 shadow-sm">
            <div className="flex gap-2 px-6 md:px-8 py-2.5">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="h-9 rounded-full bg-slate-200 animate-pulse flex-shrink-0"
                  style={{ width: `${70 + (i % 3) * 30}px` }}
                />
              ))}
            </div>
          </div>

          <div className="p-4 md:p-8">
            {/* Page title */}
            <div className="h-7 w-56 bg-slate-200 rounded animate-pulse mb-6" />

            {/* Category heading */}
            <div className="h-4 w-32 bg-slate-200 rounded animate-pulse mb-3" />

            {/* Table */}
            <div className="border border-gray-100 rounded-xl overflow-hidden">
              {/* Table header */}
              <div
                className="hidden md:grid items-center px-4 py-4 border-b border-gray-100 bg-gray-50/50"
                style={{ gridTemplateColumns: "60px 140px 1fr 120px 140px 100px" }}
              >
                {["w-10", "w-8", "w-20", "w-16", "w-14", "w-10"].map((w, i) => (
                  <div key={i} className={`h-3 ${w} bg-slate-200 rounded animate-pulse`} />
                ))}
              </div>

              {/* Product rows */}
              <div className="divide-y divide-gray-50">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex flex-col gap-4 p-4 md:grid md:items-center md:px-4 md:py-4 md:gap-0"
                    style={{ gridTemplateColumns: "60px 140px 1fr 120px 140px 100px" }}
                  >
                    {/* Thumbnail */}
                    <div className="w-[44px] h-[44px] bg-slate-200 rounded animate-pulse" />
                    {/* SKU */}
                    <div className="h-4 w-16 bg-slate-200 rounded animate-pulse" />
                    {/* Description */}
                    <div className="space-y-2 pr-4">
                      <div className="h-4 w-4/5 bg-slate-200 rounded animate-pulse" />
                      <div className="h-6 w-28 bg-slate-200 rounded animate-pulse" />
                    </div>
                    {/* Price */}
                    <div className="h-4 w-16 bg-slate-200 rounded animate-pulse" />
                    {/* Quantity */}
                    <div className="h-10 w-28 bg-slate-200 rounded-lg animate-pulse" />
                    {/* Add button */}
                    <div className="h-10 w-16 bg-slate-200 rounded animate-pulse md:ml-auto" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Cart sidebar skeleton */}
        <aside className="hidden md:flex w-[340px] flex-shrink-0 border-l border-gray-100 flex-col bg-white">
          <div className="p-6 border-b border-gray-100">
            <div className="h-5 w-28 bg-slate-200 rounded animate-pulse" />
          </div>
          <div className="flex-1 p-6 space-y-4">
            <div className="h-4 w-full bg-slate-200 rounded animate-pulse" />
            <div className="h-4 w-3/4 bg-slate-200 rounded animate-pulse" />
            <div className="h-4 w-full bg-slate-200 rounded animate-pulse" />
          </div>
          <div className="p-6 border-t border-gray-100 space-y-3">
            <div className="flex justify-between">
              <div className="h-4 w-16 bg-slate-200 rounded animate-pulse" />
              <div className="h-4 w-20 bg-slate-200 rounded animate-pulse" />
            </div>
            <div className="flex justify-between">
              <div className="h-4 w-8 bg-slate-200 rounded animate-pulse" />
              <div className="h-4 w-16 bg-slate-200 rounded animate-pulse" />
            </div>
            <div className="flex justify-between">
              <div className="h-5 w-12 bg-slate-200 rounded animate-pulse" />
              <div className="h-5 w-24 bg-slate-200 rounded animate-pulse" />
            </div>
            <div className="h-10 w-full bg-slate-200 rounded-lg animate-pulse mt-4" />
          </div>
        </aside>
      </main>
    </>
  );
}
