'use client';

import { Suspense } from 'react';
import { CADDetailPage } from '@/components/cad/CADDetailPage';

// Next.js 14: `params` is a plain object (sync). Next 15 changes it to a Promise
// that you'd unwrap with `use()`; do not adopt that pattern here.
// CADDetailPage reads useSearchParams (for the joint pose), which Next 14
// requires to be wrapped in a Suspense boundary at build time.
export default function Page({ params }: { params: { recordId: string } }) {
  return (
    <Suspense fallback={null}>
      <CADDetailPage recordId={params.recordId} />
    </Suspense>
  );
}
