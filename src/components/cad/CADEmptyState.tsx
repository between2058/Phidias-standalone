'use client';

export function CADEmptyState({ title, hint, retry }: { title: string; hint?: string; retry?: () => void }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[var(--bg-primary)] text-center">
      <div className="max-w-md space-y-2 rounded-md border border-white/10 bg-[var(--bg-card)]/60 px-6 py-5 backdrop-blur-sm">
        <p className="text-white">{title}</p>
        {hint && <p className="text-sm text-slate-400">{hint}</p>}
        {retry && (
          <button
            type="button"
            onClick={retry}
            className="rounded-md bg-[var(--accent-purple)]/20 px-3 py-1 text-sm text-white hover:bg-[var(--accent-purple)]/30"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
}
