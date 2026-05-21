'use client';

import { use } from 'react';
import { CADDetailPage } from '@/components/cad/CADDetailPage';

export default function Page({ params }: { params: Promise<{ recordId: string }> }) {
  const { recordId } = use(params);
  return <CADDetailPage recordId={recordId} />;
}
