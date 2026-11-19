export default function LoadingUniversities() {
  return (
    <div className="space-y-5" aria-busy="true">
      <div className="bg-muted h-8 w-64 animate-pulse rounded" />
      <div className="bg-muted h-40 animate-pulse rounded-xl" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="bg-muted h-52 animate-pulse rounded-xl" />
        ))}
      </div>
      <span className="sr-only">Loading university discovery results…</span>
    </div>
  );
}
