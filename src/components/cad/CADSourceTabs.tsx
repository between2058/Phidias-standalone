'use client';

import { clsx } from 'clsx';
import type { SourceTab } from '@/lib/api/library';

const TABS: { value: SourceTab; label: string }[] = [
  { value: 'dataset', label: 'Dataset' },
  { value: 'workbench', label: 'Workbench' },
  { value: 'all', label: 'All' },
];

export function CADSourceTabs({ value, onChange }: { value: SourceTab; onChange: (v: SourceTab) => void }) {
  return (
    <div className="flex gap-1 border-b border-white/10 px-4 py-2">
      {TABS.map((t) => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={clsx(
            'rounded-md px-3 py-1.5 text-sm transition',
            value === t.value
              ? 'bg-[var(--accent-purple)]/20 text-white'
              : 'text-slate-400 hover:text-slate-200',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
