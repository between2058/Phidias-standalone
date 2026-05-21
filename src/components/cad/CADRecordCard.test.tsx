import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CADRecordCard } from './CADRecordCard';
import type { RecordSummary } from '@/lib/api/library';

const sample = {
  record_id: 'rec_x',
  title: 'A red coffee mug',
  prompt_preview: 'a red coffee mug with a handle',
  rating: 4,
  effective_rating: 4,
  category_slug: 'mugs',
  agent_harness: 'articraft',
  has_traces: false,
  collections: [],
  revision_count: 1,
  has_history: false,
  has_compile_report: true,
  has_provenance: true,
  has_cost: true,
  // remaining nullable fields set to null
} as RecordSummary;

describe('CADRecordCard', () => {
  it('shows title, rating, category', () => {
    render(<CADRecordCard record={sample} selected={false} onSelect={() => {}} />);
    expect(screen.getByText('A red coffee mug')).toBeInTheDocument();
    expect(screen.getByText('mugs')).toBeInTheDocument();
    expect(screen.getByLabelText(/rating/i)).toBeInTheDocument();
  });
});
