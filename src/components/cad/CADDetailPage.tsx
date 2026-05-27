'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getSummary, type RecordSummary } from '@/lib/api/library';
import { CADInspector } from './CADInspector';
import { CADViewer } from './CADViewer';
import { CADJointControls } from './CADJointControls';
import { decodePose, encodePose } from '@/lib/cad/pose';
import type { JointSpec } from '@/lib/three/urdf/types';

export function CADDetailPage({ recordId }: { recordId: string }) {
  const router = useRouter();
  const usp = useSearchParams();
  const pose = decodePose(usp.get('pose'));
  const [summary, setSummary] = useState<RecordSummary | null>(null);
  const [summaryErr, setSummaryErr] = useState<string | null>(null);
  const [joints, setJoints] = useState<JointSpec[]>([]);

  useEffect(() => {
    setSummaryErr(null);
    getSummary(recordId)
      .then(setSummary)
      .catch((e) => setSummaryErr(e?.message ?? String(e)));
  }, [recordId]);

  const setPose = (next: Record<string, number>) => {
    const encoded = encodePose(next);
    const params = new URLSearchParams(usp.toString());
    if (encoded) params.set('pose', encoded);
    else params.delete('pose');
    router.replace(`/workspace/cad/${recordId}?${params.toString()}`);
  };

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
        <CADViewer recordId={recordId} urdfPath={urdfPath} pose={pose} onJointsReady={setJoints} />
      </div>
      <CADInspector
        recordId={recordId}
        summary={summary}
        jointsSlot={<CADJointControls joints={joints} pose={pose} onChange={setPose} />}
      />
    </div>
  );
}
