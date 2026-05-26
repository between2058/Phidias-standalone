import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { computeRadialVectors, explodeOffset, easeInOutCubic } from '@/lib/segment/explode';

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

describe('computeRadialVectors', () => {
  it('points each part outward from the averaged center', () => {
    const m = computeRadialVectors([
      { key: 'a', centroid: v(1, 0, 0) },
      { key: 'b', centroid: v(-1, 0, 0) },
    ]);
    // center = (0,0,0); radials are the centroids themselves, opposite directions
    expect(m.get('a')!.x).toBeCloseTo(1);
    expect(m.get('b')!.x).toBeCloseTo(-1);
    expect(m.get('a')!.clone().normalize().dot(m.get('b')!.clone().normalize())).toBeCloseTo(-1);
  });

  it('gives a center-coincident part a non-zero fallback direction', () => {
    const m = computeRadialVectors([
      { key: 'a', centroid: v(1, 0, 0) },
      { key: 'b', centroid: v(-1, 0, 0) },
      { key: 'c', centroid: v(0, 0, 0) }, // == center => degenerate
    ]);
    const c = m.get('c')!;
    expect(c.length()).toBeGreaterThan(0); // moved, not stuck
    expect(c.length()).toBeCloseTo(1); // scaled to avg radial magnitude (=1 here)
  });

  it('returns an empty map for no parts', () => {
    expect(computeRadialVectors([]).size).toBe(0);
  });
});

describe('explodeOffset', () => {
  it('is zero when amount is zero', () => {
    expect(explodeOffset(v(2, 0, 0), 0, 1).length()).toBe(0);
  });
  it('is zero when progress is zero', () => {
    expect(explodeOffset(v(2, 0, 0), 1, 0).length()).toBe(0);
  });
  it('scales linearly with amount * progress', () => {
    const o = explodeOffset(v(2, 0, 0), 1, 0.5);
    expect(o.x).toBeCloseTo(1);
  });
  it('does not mutate the input vector', () => {
    const radial = v(2, 0, 0);
    explodeOffset(radial, 1, 1);
    expect(radial.x).toBe(2);
  });
});

describe('easeInOutCubic', () => {
  it('hits the expected anchor points', () => {
    expect(easeInOutCubic(0)).toBeCloseTo(0);
    expect(easeInOutCubic(1)).toBeCloseTo(1);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5);
  });
  it('clamps out-of-range input', () => {
    expect(easeInOutCubic(-1)).toBeCloseTo(0);
    expect(easeInOutCubic(2)).toBeCloseTo(1);
  });
  it('is monotonically non-decreasing across [0,1]', () => {
    let prev = -Infinity;
    for (let i = 0; i <= 20; i++) {
      const cur = easeInOutCubic(i / 20);
      expect(cur).toBeGreaterThanOrEqual(prev);
      prev = cur;
    }
  });
});
