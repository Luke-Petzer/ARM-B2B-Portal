export default function CatalogueLoading() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* NavBar placeholder */}
      <div className="h-[72px] flex-shrink-0 border-b border-gray-100 bg-white/80 animate-pulse" />

      {/* Image grid skeleton */}
      <div className="flex-1">
        <div className="max-w-4xl mx-auto">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="w-full bg-slate-100 animate-pulse"
              style={{ aspectRatio: "1240 / 1754" }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
