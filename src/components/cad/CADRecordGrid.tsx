'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { browseRecords, type BrowseFilters, type BrowseResponse, type RecordSummary } from '@/lib/api/library';
import { CADRecordCard } from './CADRecordCard';

interface Props {
  filters: BrowseFilters;
  onFacetsUpdate: (facets: BrowseResponse['facets'], total: number) => void;
  onSelect: (recordId: string) => void;
  selectedId: string | null;
}

const PAGE = 60;

export function CADRecordGrid({ filters, onFacetsUpdate, onSelect, selectedId }: Props) {
  const [records, setRecords] = useState<RecordSummary[]>([]);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const hasStarted = useRef(false);
  const requestKey = JSON.stringify(filters);

  useEffect(() => {
    setRecords([]);
    setOffset(0);
    setTotal(0);
    hasStarted.current = false;
  }, [requestKey]);

  const loadMore = useCallback(async () => {
    if (loading) return;
    if (records.length > 0 && records.length >= total) return;
    hasStarted.current = true;
    setLoading(true);
    setErr(null);
    try {
      const res = await browseRecords({ ...filters, offset, limit: PAGE });
      setRecords((prev) => (offset === 0 ? res.records : [...prev, ...res.records]));
      setTotal(res.total);
      setOffset(offset + res.records.length);
      onFacetsUpdate(res.facets, res.total);
    } catch (e: any) {
      setErr(e.message ?? 'failed');
    } finally {
      setLoading(false);
    }
  }, [filters, offset, loading, records.length, total, onFacetsUpdate]);

  useEffect(() => {
    if (records.length === 0 && !loading) loadMore();
  }, [requestKey, records.length, loading, loadMore]);

  // Hold the latest loadMore in a ref so the IntersectionObserver doesn't
  // need to disconnect/reconnect after every successful fetch.
  const loadMoreRef = useRef(loadMore);
  useEffect(() => {
    loadMoreRef.current = loadMore;
  }, [loadMore]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) loadMoreRef.current();
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  if (err) {
    return (
      <div className="flex h-full items-center justify-center text-red-400">
        <div>
          <p>{err}</p>
          <button
            type="button"
            className="mt-2 underline"
            onClick={() => {
              setOffset(0);
              setRecords([]);
              hasStarted.current = false;
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!loading && records.length === 0 && hasStarted.current) {
    return <div className="flex h-full items-center justify-center text-slate-500">No records match</div>;
  }

  return (
    <div className="overflow-auto px-4 py-3">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
        {records.map((r) => (
          <CADRecordCard key={r.record_id} record={r} selected={selectedId === r.record_id} onSelect={onSelect} />
        ))}
      </div>
      <div ref={sentinelRef} className="h-8" />
      {loading && <div className="py-4 text-center text-slate-500">Loading…</div>}
    </div>
  );
}
