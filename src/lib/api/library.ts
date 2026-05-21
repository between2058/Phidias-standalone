export type SourceTab = 'dataset' | 'workbench' | 'all';

export interface RecordSummary {
  record_id: string;
  title: string;
  prompt_preview: string;
  rating: number | null;
  secondary_rating: number | null;
  effective_rating: number | null;
  author: string | null;
  rated_by: string | null;
  secondary_rated_by: string | null;
  created_at: string | null;
  updated_at: string | null;
  viewer_asset_updated_at: string | null;
  sdk_package: string | null;
  provider: string | null;
  model_id: string | null;
  creator_mode: string | null;
  external_agent: string | null;
  agent_harness: string;
  has_traces: boolean;
  thinking_level: string | null;
  turn_count: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  total_cost_usd: number | null;
  category_slug: string | null;
  run_id: string | null;
  run_status: string | null;
  run_message: string | null;
  active_revision_id: string | null;
  origin_record_id: string | null;
  parent_record_id: string | null;
  revision_count: number;
  has_history: boolean;
  collections: string[];
  materialization_status: string | null;
  has_compile_report: boolean;
  has_provenance: boolean;
  has_cost: boolean;
}

export interface BrowseFacets {
  models: string[];
  sdk_packages: string[];
  agent_harnesses: string[];
  authors: string[];
  categories: string[];
  cost_min: number | null;
  cost_max: number | null;
}

export interface BrowseResponse {
  source: string;
  total: number;
  source_total: number;
  offset: number;
  limit: number;
  record_ids: string[];
  records: RecordSummary[];
  facets: BrowseFacets;
}

export interface BrowseFilters {
  source: SourceTab;
  q?: string;
  time?: string;
  time_from?: string;
  time_to?: string;
  model?: string;
  sdk?: string;
  agent_harness?: string[];
  author?: string[];
  category?: string[];
  cost_min?: number;
  cost_max?: number;
  rating?: string[];
  secondary_rating?: string[];
  offset?: number;
  limit?: number;
}

export class LibraryApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'LibraryApiError';
  }
}

const BASE = '/api/library';

function appendParam(usp: URLSearchParams, key: string, value: unknown) {
  if (value === undefined || value === null || value === '') return;
  if (Array.isArray(value)) {
    for (const v of value) usp.append(key, String(v));
  } else {
    usp.set(key, String(value));
  }
}

function serializeBrowseFilters(f: BrowseFilters): string {
  const usp = new URLSearchParams();
  appendParam(usp, 'source', f.source);
  appendParam(usp, 'q', f.q);
  appendParam(usp, 'time', f.time);
  appendParam(usp, 'time_from', f.time_from);
  appendParam(usp, 'time_to', f.time_to);
  appendParam(usp, 'model', f.model);
  appendParam(usp, 'sdk', f.sdk);
  appendParam(usp, 'agent_harness', f.agent_harness);
  appendParam(usp, 'author', f.author);
  appendParam(usp, 'category', f.category);
  appendParam(usp, 'cost_min', f.cost_min);
  appendParam(usp, 'cost_max', f.cost_max);
  appendParam(usp, 'rating', f.rating);
  appendParam(usp, 'secondary_rating', f.secondary_rating);
  appendParam(usp, 'offset', f.offset);
  appendParam(usp, 'limit', f.limit);
  return usp.toString();
}

export async function browseRecords(filters: BrowseFilters): Promise<BrowseResponse> {
  const qs = serializeBrowseFilters(filters);
  const res = await fetch(`${BASE}/records/browse?${qs}`);
  if (!res.ok) {
    throw new LibraryApiError(res.status, await res.text());
  }
  return (await res.json()) as BrowseResponse;
}

export async function getSummary(recordId: string): Promise<RecordSummary> {
  const res = await fetch(`${BASE}/records/${recordId}/summary`);
  if (!res.ok) throw new LibraryApiError(res.status, await res.text());
  return (await res.json()) as RecordSummary;
}

export async function getHistory(recordId: string): Promise<unknown> {
  const res = await fetch(`${BASE}/records/${recordId}/history`);
  if (!res.ok) throw new LibraryApiError(res.status, await res.text());
  return res.json();
}

export async function fetchText(recordId: string, path: string): Promise<string> {
  const res = await fetch(`${BASE}/records/${recordId}/text/${path}`);
  if (!res.ok) throw new LibraryApiError(res.status, await res.text());
  return res.text();
}

export function fileUrl(recordId: string, path: string): string {
  return `${BASE}/records/${recordId}/files/${path}`;
}

// Sidecar liveness — uses /api/bootstrap which returns the viewer bootstrap blob.
// (The sidecar does not expose /api/status; /health exists but lives outside the
// /api/* prefix and therefore is not reachable through our /api/library/* rewrite.)
export async function getStatus(): Promise<unknown> {
  const res = await fetch(`${BASE}/bootstrap`);
  if (!res.ok) throw new LibraryApiError(res.status, await res.text());
  return res.json();
}
