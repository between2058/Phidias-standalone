'use client';

import { Suspense } from 'react';
import { CADLibraryPage } from '@/components/cad/CADLibraryPage';

// useSearchParams inside CADLibraryPage requires a Suspense boundary at build
// time under Next 14's prerender path.
export default function Page() {
  return (
    <Suspense fallback={null}>
      <CADLibraryPage />
    </Suspense>
  );
}
