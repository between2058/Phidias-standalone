import type { BrowseFilters, SourceTab } from '@/lib/api/library';

const ARRAY_KEYS = ['category', 'author', 'agent_harness', 'rating', 'secondary_rating'] as const;
const NUMBER_KEYS = ['cost_min', 'cost_max', 'offset', 'limit'] as const;

export function filtersToSearchParams(f: BrowseFilters): URLSearchParams {
  const usp = new URLSearchParams();
  usp.set('source', f.source);
  if (f.q) usp.set('q', f.q);
  if (f.time) usp.set('time', f.time);
  if (f.time_from) usp.set('time_from', f.time_from);
  if (f.time_to) usp.set('time_to', f.time_to);
  if (f.model) usp.set('model', f.model);
  if (f.sdk) usp.set('sdk', f.sdk);
  for (const key of ARRAY_KEYS) {
    const v = f[key];
    if (Array.isArray(v)) for (const item of v) usp.append(key, item);
  }
  for (const key of NUMBER_KEYS) {
    const v = f[key];
    if (v !== undefined) usp.set(key, String(v));
  }
  return usp;
}

export function searchParamsToFilters(usp: URLSearchParams): BrowseFilters {
  const source = (usp.get('source') as SourceTab) ?? 'dataset';
  const f: BrowseFilters = { source };
  const q = usp.get('q'); if (q) f.q = q;
  const time = usp.get('time'); if (time) f.time = time;
  const tf = usp.get('time_from'); if (tf) f.time_from = tf;
  const tt = usp.get('time_to'); if (tt) f.time_to = tt;
  const model = usp.get('model'); if (model) f.model = model;
  const sdk = usp.get('sdk'); if (sdk) f.sdk = sdk;
  for (const key of ARRAY_KEYS) {
    const arr = usp.getAll(key);
    if (arr.length) (f as any)[key] = arr;
  }
  for (const key of NUMBER_KEYS) {
    const v = usp.get(key);
    if (v !== null) (f as any)[key] = Number(v);
  }
  return f;
}
