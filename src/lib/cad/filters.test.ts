import { describe, it, expect } from 'vitest';
import { filtersToSearchParams, searchParamsToFilters } from './filters';
import type { BrowseFilters } from '@/lib/api/library';

describe('filters URL helpers', () => {
  it('round-trips', () => {
    const f: BrowseFilters = {
      source: 'dataset',
      q: 'hinge',
      category: ['fridge', 'oven'],
      rating: ['5'],
      limit: 60,
    };
    const params = filtersToSearchParams(f);
    expect(params.toString()).toContain('source=dataset');
    expect(params.toString()).toContain('q=hinge');
    const restored = searchParamsToFilters(params);
    expect(restored).toEqual(f);
  });

  it('defaults to source=dataset when missing', () => {
    const restored = searchParamsToFilters(new URLSearchParams(''));
    expect(restored.source).toBe('dataset');
  });
});
