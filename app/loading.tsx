export default function Loading() {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#0a0a0e] px-4 py-8 md:px-6 md:py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 animate-pulse">
        <div className="space-y-3 border-b border-white/5 pb-6">
          <div className="h-4 w-28 rounded-full bg-white/[0.05]" />
          <div className="h-10 w-64 max-w-full rounded-2xl bg-white/[0.06]" />
          <div className="h-4 w-96 max-w-full rounded-full bg-white/[0.04]" />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[...Array(4)].map((_, index) => (
            <div
              key={index}
              className="h-24 rounded-2xl border border-white/[0.05] bg-white/[0.03]"
            />
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.9fr)]">
          <div className="h-[420px] rounded-3xl border border-white/[0.05] bg-white/[0.03]" />
          <div className="space-y-4">
            <div className="h-48 rounded-3xl border border-white/[0.05] bg-white/[0.03]" />
            <div className="h-48 rounded-3xl border border-white/[0.05] bg-white/[0.03]" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {[...Array(6)].map((_, index) => (
            <div
              key={index}
              className="h-28 rounded-2xl border border-white/[0.05] bg-white/[0.025]"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
