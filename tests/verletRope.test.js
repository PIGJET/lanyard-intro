import { describe, it, expect } from 'vitest';
import {
  createRope, step, severAt, isIntact, firstBreak, activeSegments, setAnchor, getRuns, applyWind,
} from '../src/physics/verletRope.js';

const mk = (over = {}) =>
  createRope({ anchor: [0, 3, 0], length: 2, segments: 10, ...over });

describe('createRope', () => {
  it('creates segments+1 points hanging straight down from anchor', () => {
    const rope = mk();
    expect(rope.points).toHaveLength(11);
    expect(rope.constraints).toHaveLength(10);
    expect(rope.points[0].pos).toEqual([0, 3, 0]);
    expect(rope.points[10].pos[1]).toBeCloseTo(1); // 3 - 2
    expect(rope.points[0].pinned).toBe(true);
    expect(rope.points[5].pinned).toBe(false);
  });
});

describe('step', () => {
  it('keeps the head pinned to the anchor under gravity', () => {
    const rope = mk();
    for (let i = 0; i < 120; i++) step(rope, 1 / 60);
    expect(rope.points[0].pos).toEqual([0, 3, 0]);
  });

  it('settles near rest length (not stretched to infinity, not collapsed)', () => {
    const rope = mk();
    for (let i = 0; i < 600; i++) step(rope, 1 / 60);
    const tailY = rope.points[10].pos[1];
    // rest tail y = 1; allow small solver stretch
    expect(tailY).toBeLessThan(1.05);
    expect(tailY).toBeGreaterThan(0.7);
  });

  it('follows a moved anchor', () => {
    const rope = mk();
    setAnchor(rope, 5, 3, 0);
    for (let i = 0; i < 300; i++) step(rope, 1 / 60);
    expect(rope.points[0].pos[0]).toBe(5);
    expect(rope.points[10].pos[0]).toBeCloseTo(5, 0); // tail swings under new anchor
  });

  it('pins the tail to an external endPin (badge attachment)', () => {
    const rope = mk();
    const pin = [0.5, 1.2, 0];
    for (let i = 0; i < 60; i++) step(rope, 1 / 60, 6, pin);
    expect(rope.points[10].pos).toEqual(pin);
  });

  it('does not explode with a large-ish dt spike', () => {
    const rope = mk();
    for (let i = 0; i < 30; i++) step(rope, 1 / 60);
    step(rope, 1 / 15); // 4x frame spike
    for (let i = 0; i < 60; i++) step(rope, 1 / 60);
    for (const p of rope.points) {
      expect(Number.isFinite(p.pos[0])).toBe(true);
      expect(Math.abs(p.pos[1])).toBeLessThan(50);
    }
  });
});

describe('severAt', () => {
  it('breaks exactly one constraint and reports state', () => {
    const rope = mk();
    expect(isIntact(rope)).toBe(true);
    expect(severAt(rope, 4)).toBe(true);
    expect(severAt(rope, 4)).toBe(false); // already broken
    expect(isIntact(rope)).toBe(false);
    expect(firstBreak(rope)).toBe(4);
  });

  it('rejects out-of-range indices', () => {
    const rope = mk();
    expect(severAt(rope, -1)).toBe(false);
    expect(severAt(rope, 10)).toBe(false);
    expect(isIntact(rope)).toBe(true);
  });

  it('after severing, the lower part falls while the upper part stays hung', () => {
    const rope = mk();
    for (let i = 0; i < 120; i++) step(rope, 1 / 60);
    severAt(rope, 5);
    const tailBefore = rope.points[10].pos[1];
    for (let i = 0; i < 90; i++) step(rope, 1 / 60);
    expect(rope.points[10].pos[1]).toBeLessThan(tailBefore - 0.5); // fell
    expect(rope.points[0].pos[1]).toBe(3); // anchor intact
    // upper stub's last connected point still near its hung position
    expect(rope.points[5].pos[1]).toBeGreaterThan(1.4);
  });
});

describe('activeSegments', () => {
  it('excludes broken segments and keeps indices aligned', () => {
    const rope = mk();
    severAt(rope, 3);
    const segs = activeSegments(rope);
    expect(segs).toHaveLength(9);
    expect(segs.find(([i]) => i === 3)).toBeUndefined();
    const [i, a, b] = segs[0];
    expect(i).toBe(0);
    expect(a).toBe(rope.points[0].pos);
    expect(b).toBe(rope.points[1].pos);
  });
});

describe('getRuns', () => {
  it('intact rope is a single run of all points', () => {
    const rope = mk();
    const runs = getRuns(rope);
    expect(runs).toHaveLength(1);
    expect(runs[0]).toHaveLength(11);
    expect(runs[0][0]).toBe(rope.points[0].pos); // live references, no copies
  });

  it('one cut yields two runs split at the break', () => {
    const rope = mk();
    severAt(rope, 4);
    const runs = getRuns(rope);
    expect(runs).toHaveLength(2);
    expect(runs[0]).toHaveLength(5);  // points 0..4
    expect(runs[1]).toHaveLength(6);  // points 5..10
    expect(runs[0][4]).toBe(rope.points[4].pos);
    expect(runs[1][0]).toBe(rope.points[5].pos);
  });

  it('cutting the first segment drops the 1-point stub, keeps the tail', () => {
    const rope = mk();
    severAt(rope, 0);
    const runs = getRuns(rope);
    expect(runs).toHaveLength(1);
    expect(runs[0]).toHaveLength(10); // points 1..10; anchor stub is undrawable
  });

  it('adjacent cuts drop the stranded middle point', () => {
    const rope = mk();
    severAt(rope, 4);
    severAt(rope, 5);
    const runs = getRuns(rope);
    expect(runs).toHaveLength(2); // point 5 is stranded alone, dropped
    expect(runs[0]).toHaveLength(5);
    expect(runs[1]).toHaveLength(5);
  });
});

describe('applyWind', () => {
  it('perturbs free points but never the pinned anchor', () => {
    const rope = mk();
    const anchorBefore = [...rope.points[0].pos];
    const tailBefore = [...rope.points[10].pos];
    applyWind(rope, 1.234, 1);
    expect(rope.points[0].pos).toEqual(anchorBefore);
    expect(rope.points[10].pos).not.toEqual(tailBefore);
  });

  it('strength 0 is a no-op', () => {
    const rope = mk();
    const snapshot = rope.points.map((p) => [...p.pos]);
    applyWind(rope, 5, 0);
    rope.points.forEach((p, i) => expect(p.pos).toEqual(snapshot[i]));
  });

  it('keeps the rope stable under continuous wind (sways, does not explode)', () => {
    const rope = mk();
    let maxX = 0;
    for (let i = 0; i < 1200; i++) {
      applyWind(rope, i / 60, 1);
      // reuse imported step
      step(rope, 1 / 60);
      maxX = Math.max(maxX, Math.abs(rope.points[10].pos[0]));
    }
    expect(maxX).toBeGreaterThan(0.001); // visibly sways
    expect(maxX).toBeLessThan(0.5);      // stays gentle, no runaway
  });
});
