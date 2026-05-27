'use client';

import { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { fetchText, type RecordSummary } from '@/lib/api/library';

type Tab = 'summary' | 'code' | 'prompt' | 'joints';

const TABS: { value: Tab; label: string }[] = [
  { value: 'summary', label: 'Summary' },
  { value: 'code', label: 'Code' },
  { value: 'prompt', label: 'Prompt' },
  { value: 'joints', label: 'Joints' },
];

interface Props {
  recordId: string;
  summary: RecordSummary | null;
  jointsSlot: React.ReactNode;
}

export function CADInspector({ recordId, summary, jointsSlot }: Props) {
  const [tab, setTab] = useState<Tab>('summary');
  const revisionId = summary?.active_revision_id ?? 'rev_000001';
  return (
    <aside className="flex h-full w-[340px] flex-col border-l border-white/5 bg-[var(--bg-card)]/60 backdrop-blur-sm">
      <div className="flex border-b border-white/5" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={tab === t.value}
            onClick={() => setTab(t.value)}
            className={clsx(
              'flex-1 py-2 text-xs uppercase tracking-wide',
              tab === t.value ? 'text-white' : 'text-slate-500 hover:text-slate-300',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto p-3 text-sm">
        {tab === 'summary' && summary && <SummaryTab summary={summary} />}
        {tab === 'code' && <TextTab recordId={recordId} path={`revisions/${revisionId}/model.py`} />}
        {tab === 'prompt' && <TextTab recordId={recordId} path={`revisions/${revisionId}/prompt.txt`} />}
        {tab === 'joints' && jointsSlot}
      </div>
    </aside>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between border-b border-white/5 py-1">
      <span className="text-slate-500">{k}</span>
      <span className="text-right text-slate-200">{v}</span>
    </div>
  );
}

function SummaryTab({ summary }: { summary: RecordSummary }) {
  return (
    <div className="space-y-1">
      <Row k="ID" v={<code className="text-xs">{summary.record_id}</code>} />
      <Row k="Title" v={summary.title} />
      <Row k="Category" v={summary.category_slug ?? '—'} />
      <Row k="Rating" v={summary.effective_rating?.toFixed(1) ?? '—'} />
      <Row k="Author" v={summary.author ?? '—'} />
      <Row k="Provider" v={summary.provider ?? '—'} />
      <Row k="Model" v={summary.model_id ?? '—'} />
      <Row k="Cost (USD)" v={summary.total_cost_usd?.toFixed(4) ?? '—'} />
      <Row k="Created" v={summary.created_at ?? '—'} />
    </div>
  );
}

function TextTab({ recordId, path }: { recordId: string; path: string }) {
  const [text, setText] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    setText(null); setErr(null);
    fetchText(recordId, path).then(setText).catch((e) => setErr(e.message));
  }, [recordId, path]);
  if (err) return <div className="text-red-400">{err}</div>;
  if (text === null) return <div className="text-slate-500">Loading…</div>;
  return <pre className="whitespace-pre-wrap font-mono text-xs text-slate-300">{text}</pre>;
}
