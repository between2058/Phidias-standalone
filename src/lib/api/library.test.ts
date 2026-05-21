import { describe, expect, it, beforeEach, vi, afterEach, type MockedFunction } from 'vitest';
import { browseRecords, getSummary, getStatus, fileUrl, type BrowseResponse, type RecordSummary } from './library';
import sampleBrowse from '../../components/cad/__fixtures__/sample-browse-response.json';
import sampleSummary from '../../components/cad/__fixtures__/sample-record-summary.json';

type FetchMock = MockedFunction<typeof fetch>;

describe('browseRecords', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('serializes filters and parses the response', async () => {
    (global.fetch as FetchMock).mockResolvedValue({
      ok: true,
      json: async () => ({
        source: 'dataset',
        total: 1, source_total: 1, offset: 0, limit: 60,
        record_ids: ['rec_x'], records: [],
        facets: { models: [], sdk_packages: [], agent_harnesses: [], authors: [], categories: [], cost_min: null, cost_max: null },
      } satisfies BrowseResponse),
    } as Response);
    const res = await browseRecords({ source: 'dataset', q: 'hinge', limit: 60 });
    const calledUrl = (global.fetch as FetchMock).mock.calls[0][0] as string;
    expect(calledUrl).toContain('/api/library/records/browse?');
    expect(calledUrl).toContain('source=dataset');
    expect(calledUrl).toContain('q=hinge');
    expect(calledUrl).toContain('limit=60');
    expect(res.source).toBe('dataset');
  });

  it('throws LibraryApiError on non-ok responses', async () => {
    (global.fetch as FetchMock).mockResolvedValue({ ok: false, status: 500, text: async () => 'boom' } as Response);
    await expect(browseRecords({ source: 'dataset' })).rejects.toThrow(/boom/);
  });

  it('passes "all" through (sidecar treats unknown source as no filter)', async () => {
    (global.fetch as FetchMock).mockResolvedValue({
      ok: true,
      json: async () => ({ source: 'all', total: 0, source_total: 0, offset: 0, limit: 60, record_ids: [], records: [], facets: { models: [], sdk_packages: [], agent_harnesses: [], authors: [], categories: [], cost_min: null, cost_max: null } }),
    } as Response);
    await browseRecords({ source: 'all' });
    expect((global.fetch as FetchMock).mock.calls[0][0]).toContain('source=all');
  });
});

describe('getSummary', () => {
  it('GETs the summary endpoint', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ record_id: 'rec_x' }),
    } as Response);
    const s = await getSummary('rec_x');
    expect((global.fetch as FetchMock).mock.calls[0][0]).toBe('/api/library/records/rec_x/summary');
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
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) } as Response);
    await getStatus();
    expect((global.fetch as FetchMock).mock.calls[0][0]).toBe('/api/library/bootstrap');
  });
});

describe('schema contract', () => {
  it('BrowseResponse fixture matches the TS type shape at runtime', () => {
    const r = sampleBrowse as BrowseResponse;
    expect(typeof r.source).toBe('string');
    expect(typeof r.total).toBe('number');
    expect(Array.isArray(r.records)).toBe(true);
    expect(typeof r.facets).toBe('object');
    expect(Array.isArray(r.facets.categories)).toBe(true);
  });

  it('RecordSummary fixture has the required fields', () => {
    const s = sampleSummary as RecordSummary;
    expect(typeof s.record_id).toBe('string');
    expect(typeof s.title).toBe('string');
    expect(typeof s.prompt_preview).toBe('string');
    expect(typeof s.agent_harness).toBe('string');
    expect(typeof s.has_traces).toBe('boolean');
  });
});
