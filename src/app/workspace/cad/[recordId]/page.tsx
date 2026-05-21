'use client';

import { CADDetailPage } from '@/components/cad/CADDetailPage';

// Next.js 14: `params` is a plain object (sync). Next 15 changes it to a Promise
// that you'd unwrap with `use()`; do not adopt that pattern here.
export default function Page({ params }: { params: { recordId: string } }) {
  return <CADDetailPage recordId={params.recordId} />;
}
