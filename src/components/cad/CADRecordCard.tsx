'use client';

import { Star } from 'lucide-react';
import { clsx } from 'clsx';
import type { RecordSummary } from '@/lib/api/library';

interface Props {
  record: RecordSummary;
  selected: boolean;
  onSelect: (recordId: string) => void;
}

const GRADIENTS = [
  'from-purple-900/40 to-blue-900/40',
  'from-blue-900/40 to-cyan-900/40',
  'from-amber-900/40 to-orange-900/40',
  'from-emerald-900/40 to-teal-900/40',
];

function hashGradient(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return GRADIENTS[Math.abs(h) % GRADIENTS.length];
}

export function CADRecordCard({ record, selected, onSelect }: Props) {
  const gradient = hashGradient(record.category_slug ?? record.record_id);
  return (
    <button
      type="button"
      onClick={() => onSelect(record.record_id)}
      className={clsx(
        'group relative aspect-square w-full overflow-hidden rounded-[10px]',
        'border border-white/10 bg-gradient-to-br backdrop-blur-sm',
        'transition hover:border-white/30',
        gradient,
        selected && 'ring-2 ring-[var(--accent-purple)]',
      )}
    >
      <div className="absolute inset-0 flex items-end p-3">
        <div className="w-full">
          <div className="line-clamp-2 text-left text-sm font-medium text-white">
            {record.title}
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px] text-slate-300">
            {record.category_slug && <span>{record.category_slug}</span>}
            {record.effective_rating !== null && (
              <span aria-label={`rating ${record.effective_rating}`} className="flex items-center gap-0.5">
                <Star size={11} className="fill-amber-400 stroke-amber-400" />
                {record.effective_rating.toFixed(1)}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}
