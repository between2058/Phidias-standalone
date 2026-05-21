'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CADSourceTabs } from './CADSourceTabs';
import { CADFacetSidebar } from './CADFacetSidebar';
import { CADRecordGrid } from './CADRecordGrid';
import { filtersToSearchParams, searchParamsToFilters } from '@/lib/cad/filters';
import type { BrowseFacets, BrowseFilters, SourceTab } from '@/lib/api/library';

export function CADLibraryPage() {
  const router = useRouter();
  const usp = useSearchParams();
  const filters = useMemo<BrowseFilters>(
    () => searchParamsToFilters(usp as unknown as URLSearchParams),
    [usp],
  );
  const [facets, setFacets] = useState<BrowseFacets | null>(null);

  const setFilters = (next: BrowseFilters) => {
    const params = filtersToSearchParams(next);
    router.replace(`/workspace/cad?${params.toString()}`);
  };

  return (
    <div className="flex h-full w-full bg-[var(--bg-primary)]">
      <CADFacetSidebar filters={filters} facets={facets} onChange={setFilters} />
      <div className="flex flex-1 flex-col">
        <CADSourceTabs value={filters.source} onChange={(v: SourceTab) => setFilters({ ...filters, source: v })} />
        <div className="flex-1 overflow-hidden">
          <CADRecordGrid
            filters={filters}
            onFacetsUpdate={(f) => setFacets(f)}
            onSelect={(id) => router.push(`/workspace/cad/${id}`)}
            selectedId={null}
          />
        </div>
      </div>
    </div>
  );
}
