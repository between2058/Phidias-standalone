'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { getSummary, type RecordSummary } from '@/lib/api/library';
import { CADInspector } from './CADInspector';
import { CADViewer } from './CADViewer';
import type { JointSpec } from '@/lib/three/urdf/types';

export function CADDetailPage({ recordId }: { recordId: string }) {
  const [summary, setSummary] = useState<RecordSummary | null>(null);
  const [summaryErr, setSummaryErr] = useState<string | null>(null);
  const [joints, setJoints] = useState<JointSpec[]>([]);

  useEffect(() => {
    setSummaryErr(null);
    getSummary(recordId)
      .then(setSummary)
      .catch((e) => setSummaryErr(e?.message ?? String(e)));
  }, [recordId]);

  // Materialization cache is flat per record; the URDF is always 'model.urdf'.
  const urdfPath = 'model.urdf';

  return (
    <div className="flex h-full w-full bg-[var(--bg-primary)]">
      <div className="flex flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-white/5 px-4 py-2">
          <Link href="/workspace/cad" className="text-slate-400 hover:text-white">
            <ArrowLeft size={16} />
          </Link>
          <span className="text-sm text-white">{summary?.title ?? recordId}</span>
          {summaryErr && (
            <span className="ml-auto text-xs text-red-400">Summary unavailable: {summaryErr}</span>
          )}
        </header>
        <CADViewer recordId={recordId} urdfPath={urdfPath} pose={{}} onJointsReady={setJoints} />
      </div>
      <CADInspector
        recordId={recordId}
        summary={summary}
        jointsSlot={<div className="text-slate-500">Joints arrive in Phase 6 ({joints.length} found).</div>}
      />
    </div>
  );
}
