'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { getSummary, type RecordSummary } from '@/lib/api/library';
import { CADInspector } from './CADInspector';

export function CADDetailPage({ recordId }: { recordId: string }) {
  const [summary, setSummary] = useState<RecordSummary | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    getSummary(recordId).then(setSummary).catch((e) => setErr(e.message));
  }, [recordId]);

  return (
    <div className="flex h-full w-full bg-[var(--bg-primary)]">
      <div className="flex flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-white/5 px-4 py-2">
          <Link href="/workspace/cad" className="text-slate-400 hover:text-white">
            <ArrowLeft size={16} />
          </Link>
          <span className="text-sm text-white">{summary?.title ?? recordId}</span>
        </header>
        <div className="flex flex-1 items-center justify-center text-slate-500">
          {err ?? '3D viewer mounts here (Phase 5)'}
        </div>
      </div>
      <CADInspector
        recordId={recordId}
        summary={summary}
        jointsSlot={<div className="text-slate-500">Joints arrive in Phase 6.</div>}
      />
    </div>
  );
}
