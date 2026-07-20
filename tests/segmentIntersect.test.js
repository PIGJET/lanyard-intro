import { describe, it, expect } from 'vitest';
import {
  segmentsIntersect, pointSegmentDistance, findCut,
} from '../src/physics/segmentIntersect.js';

describe('segmentsIntersect', () => {
  it('detects a clean X crossing with correct point', () => {
    const hit = segmentsIntersect([-1, 0], [1, 0], [0, -1], [0, 1]);
    expect(hit).not.toBeNull();
    expect(hit.point[0]).toBeCloseTo(0);
    expect(hit.point[1]).toBeCloseTo(0);
  });

  it('returns null for parallel and for non-overlapping segments', () => {
    expect(segmentsIntersect([0, 0], [1, 0], [0, 1], [1, 1])).toBeNull();
    expect(segmentsIntersect([-1, 0], [-0.1, 0], [0, -1], [0, 1])).toBeNull();
  });

  it('handles endpoint touching (t or u at bounds)', () => {
    const hit = segmentsIntersect([0, 0], [1, 0], [1, -1], [1, 1]);
    expect(hit).not.toBeNull();
    expect(hit.t).toBeCloseTo(1);
  });
});

describe('pointSegmentDistance', () => {
  it('measures perpendicular distance inside the span', () => {
    expect(pointSegmentDistance([0.5, 1], [0, 0], [1, 0])).toBeCloseTo(1);
  });
  it('clamps to endpoints outside the span', () => {
    expect(pointSegmentDistance([2, 0], [0, 0], [1, 0])).toBeCloseTo(1);
  });
  it('degenerate zero-length segment behaves as a point', () => {
    expect(pointSegmentDistance([3, 4], [0, 0], [0, 0])).toBeCloseTo(5);
  });
});

describe('findCut', () => {
  // vertical "rope" made of two stacked segments at x=0
  const segs = [
    [0, [0, 2], [0, 1]],
    [1, [0, 1], [0, 0]],
  ];

  it('returns the crossed segment index and point', () => {
    const cut = findCut([-0.5, 0.5], [0.5, 0.5], segs);
    expect(cut).not.toBeNull();
    expect(cut.index).toBe(1);
    expect(cut.point[0]).toBeCloseTo(0);
    expect(cut.point[1]).toBeCloseTo(0.5);
  });

  it('misses when the swipe does not cross and radius is 0', () => {
    expect(findCut([-0.5, 3], [0.5, 3], segs, 0)).toBeNull();
  });

  it('fat-hitbox fallback catches a graze within hitRadius', () => {
    const cut = findCut([0.5, 0.5], [0.1, 0.5], segs, 0.15);
    expect(cut).not.toBeNull();
    expect(cut.index).toBe(1);
  });

  it('prefers an exact crossing over a nearby graze', () => {
    const cut = findCut([-0.05, 1.5], [0.05, 1.5], segs, 0.5);
    expect(cut.index).toBe(0);
  });
});
