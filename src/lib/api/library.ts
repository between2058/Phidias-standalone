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
