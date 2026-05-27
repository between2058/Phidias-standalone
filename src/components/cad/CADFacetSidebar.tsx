'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { BrowseFacets, BrowseFilters } from '@/lib/api/library';

interface Props {
  filters: BrowseFilters;
  facets: BrowseFacets | null;
  onChange: (next: BrowseFilters) => void;
}

function toggleArray(arr: string[] | undefined, value: string): string[] {
  const s = new Set(arr ?? []);
  if (s.has(value)) s.delete(value); else s.add(value);
  return Array.from(s);
}

function Section({ title, defaultOpen = true, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-white/5 py-2">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-3 py-1 text-xs uppercase tracking-wide text-slate-400"
      >
        <span>{title}</span>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      {open && <div className="px-3 py-1 space-y-1">{children}</div>}
    </div>
  );
}

function Check({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300 hover:text-white">
      <input type="checkbox" checked={checked} onChange={onChange} className="h-3 w-3 accent-[var(--accent-purple)]" />
      <span className="truncate">{label}</span>
    </label>
  );
}

export function CADFacetSidebar({ filters, facets, onChange }: Props) {
  return (
    <aside className="h-full w-60 overflow-y-auto border-r border-white/5 bg-[var(--bg-card)]/60 backdrop-blur-sm">
      <div className="px-3 py-3">
        <input
          type="text"
          placeholder="Search…"
          value={filters.q ?? ''}
          onChange={(e) => onChange({ ...filters, q: e.target.value || undefined })}
          className="w-full rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white placeholder:text-slate-500"
        />
      </div>

      <Section title="Category">
        {(facets?.categories ?? []).slice(0, 30).map((c) => (
          <Check
            key={c}
            label={c}
            checked={(filters.category ?? []).includes(c)}
            onChange={() => onChange({ ...filters, category: toggleArray(filters.category, c) })}
          />
        ))}
      </Section>

      <Section title="Rating">
        {[5, 4, 3, 2, 1].map((n) => (
          <Check
            key={n}
            label={'★'.repeat(n) + '☆'.repeat(5 - n)}
            checked={(filters.rating ?? []).includes(String(n))}
            onChange={() => onChange({ ...filters, rating: toggleArray(filters.rating, String(n)) })}
          />
        ))}
      </Section>

      <Section title="Model" defaultOpen={false}>
        {(facets?.models ?? []).map((m) => (
          <Check
            key={m}
            label={m}
            checked={filters.model === m}
            onChange={() => onChange({ ...filters, model: filters.model === m ? undefined : m })}
          />
        ))}
      </Section>

      <Section title="Author" defaultOpen={false}>
        {(facets?.authors ?? []).map((a) => (
          <Check
            key={a}
            label={a}
            checked={(filters.author ?? []).includes(a)}
            onChange={() => onChange({ ...filters, author: toggleArray(filters.author, a) })}
          />
        ))}
      </Section>

      <Section title="Cost (USD)" defaultOpen={false}>
        <div className="flex items-center gap-1 text-xs text-slate-400">
          <input
            type="number"
            placeholder="min"
            step="0.01"
            value={filters.cost_min ?? ''}
            onChange={(e) => onChange({ ...filters, cost_min: e.target.value ? Number(e.target.value) : undefined })}
            className="w-16 rounded border border-white/10 bg-black/30 px-1 py-0.5 text-white"
          />
          <span>—</span>
          <input
            type="number"
            placeholder="max"
            step="0.01"
            value={filters.cost_max ?? ''}
            onChange={(e) => onChange({ ...filters, cost_max: e.target.value ? Number(e.target.value) : undefined })}
            className="w-16 rounded border border-white/10 bg-black/30 px-1 py-0.5 text-white"
          />
        </div>
      </Section>

      <Section title="Time" defaultOpen={false}>
        <select
          value={filters.time ?? ''}
          onChange={(e) => onChange({ ...filters, time: e.target.value || undefined })}
          className="w-full rounded border border-white/10 bg-black/30 px-1 py-0.5 text-sm text-white"
        >
          <option value="">Any</option>
          <option value="today">Today</option>
          <option value="week">This week</option>
          <option value="month">This month</option>
        </select>
      </Section>

      <Section title="SDK" defaultOpen={false}>
        {(facets?.sdk_packages ?? []).map((s) => (
          <Check
            key={s}
            label={s}
            checked={filters.sdk === s}
            onChange={() => onChange({ ...filters, sdk: filters.sdk === s ? undefined : s })}
          />
        ))}
      </Section>
    </aside>
  );
}
