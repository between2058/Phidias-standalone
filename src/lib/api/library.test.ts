import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import { browseRecords, type BrowseResponse } from './library';

describe('browseRecords', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('serializes filters and parses the response', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        source: 'dataset',
        total: 1, source_total: 1, offset: 0, limit: 60,
        record_ids: ['rec_x'], records: [],
        facets: { models: [], sdk_packages: [], agent_harnesses: [], authors: [], categories: [], cost_min: null, cost_max: null },
      } satisfies BrowseResponse),
    });
    const res = await browseRecords({ source: 'dataset', q: 'hinge', limit: 60 });
    const calledUrl = (global.fetch as any).mock.calls[0][0] as string;
    expect(calledUrl).toContain('/api/library/records/browse?');
    expect(calledUrl).toContain('source=dataset');
    expect(calledUrl).toContain('q=hinge');
    expect(calledUrl).toContain('limit=60');
    expect(res.source).toBe('dataset');
  });

  it('throws LibraryApiError on non-ok responses', async () => {
    (global.fetch as any).mockResolvedValue({ ok: false, status: 500, text: async () => 'boom' });
    await expect(browseRecords({ source: 'dataset' })).rejects.toThrow(/boom/);
  });

  it('passes "all" through (sidecar treats unknown source as no filter)', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ source: 'all', total: 0, source_total: 0, offset: 0, limit: 60, record_ids: [], records: [], facets: { models: [], sdk_packages: [], agent_harnesses: [], authors: [], categories: [], cost_min: null, cost_max: null } }),
    });
    await browseRecords({ source: 'all' });
    expect((global.fetch as any).mock.calls[0][0]).toContain('source=all');
  });
});
