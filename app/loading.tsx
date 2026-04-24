export default function Loading() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-16 text-center gap-4">
      <div className="w-10 h-10 rounded-full border-4 border-emerald-600/30 border-t-emerald-500 animate-spin" />
      <p className="text-slate-400 text-sm">Loading…</p>
    </div>
  );
}
