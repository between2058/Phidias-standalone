import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import { browseRecords, getSummary, getStatus, fileUrl, type BrowseResponse } from './library';

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

describe('getSummary', () => {
  it('GETs the summary endpoint', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ record_id: 'rec_x' }),
    });
    const s = await getSummary('rec_x');
    expect((global.fetch as any).mock.calls[0][0]).toBe('/api/library/records/rec_x/summary');
    expect(s.record_id).toBe('rec_x');
  });
});

describe('fileUrl', () => {
  it('returns the proxied file URL for the URDF', () => {
    expect(fileUrl('rec_x', 'model.urdf'))
      .toBe('/api/library/records/rec_x/files/model.urdf');
  });
});

describe('getStatus', () => {
  it('GETs the /bootstrap endpoint', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    await getStatus();
    expect((global.fetch as any).mock.calls[0][0]).toBe('/api/library/bootstrap');
  });
});
