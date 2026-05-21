import { describe, it, expect } from 'vitest';
import { encodePose, decodePose } from './pose';

describe('pose URL helpers', () => {
  it('round-trips', () => {
    const pose = { hinge: 0.5, slider: -0.25 };
    expect(decodePose(encodePose(pose))).toEqual(pose);
  });
  it('decodes empty', () => {
    expect(decodePose('')).toEqual({});
    expect(decodePose(undefined)).toEqual({});
    expect(decodePose(null)).toEqual({});
  });
  it('decodes malformed gracefully', () => {
    expect(decodePose('not-base64!@#$%')).toEqual({});
  });
});
