import { describe, it, expect } from 'vitest';
import {
  LETTERS,
  POSES,
  lerpPose,
  poseAtLetter,
  letterProgress,
  smoothstep,
} from '../src/portfolio/handPoses.js';

describe('pose data', () => {
  it('defines a pose for every letter of LOVE', () => {
    expect(LETTERS).toEqual(['L', 'O', 'V', 'E']);
    for (const l of LETTERS) {
      const p = POSES[l];
      expect(p.fingers).toHaveLength(4);
      for (const f of p.fingers) {
        expect(f.curl).toBeGreaterThanOrEqual(0);
        expect(f.curl).toBeLessThanOrEqual(1);
        expect(Math.abs(f.spread)).toBeLessThan(0.5);
      }
      expect(p.thumb.curl).toBeGreaterThanOrEqual(0);
      expect(p.thumb.curl).toBeLessThanOrEqual(1);
      expect(p.thumb.out).toBeGreaterThanOrEqual(0);
      expect(p.thumb.out).toBeLessThanOrEqual(1);
    }
  });

  it('poses are visually distinct (L points, V splits, E folds)', () => {
    expect(POSES.L.fingers[0].curl).toBe(0); // index up
    expect(POSES.L.fingers[1].curl).toBe(1); // middle folded
    expect(POSES.L.thumb.out).toBe(1); // thumb stuck out

    expect(POSES.V.fingers[0].curl).toBe(0);
    expect(POSES.V.fingers[1].curl).toBe(0);
    // V spreads index and middle apart
    expect(POSES.V.fingers[0].spread - POSES.V.fingers[1].spread).toBeGreaterThan(0.2);

    for (const f of POSES.E.fingers) expect(f.curl).toBeGreaterThan(0.7);
  });
});

describe('lerpPose / poseAtLetter', () => {
  it('returns endpoints at t=0 and t=1', () => {
    expect(lerpPose(POSES.L, POSES.O, 0)).toEqual(POSES.L);
    expect(lerpPose(POSES.L, POSES.O, 1)).toEqual(POSES.O);
  });

  it('interpolates midway values', () => {
    const mid = lerpPose(POSES.L, POSES.O, 0.5);
    expect(mid.fingers[0].curl).toBeCloseTo((POSES.L.fingers[0].curl + POSES.O.fingers[0].curl) / 2);
    expect(mid.thumb.out).toBeCloseTo((POSES.L.thumb.out + POSES.O.thumb.out) / 2);
  });

  it('poseAtLetter hits exact letters at integers and clamps out-of-range', () => {
    expect(poseAtLetter(0)).toEqual(POSES.L);
    expect(poseAtLetter(1)).toEqual(POSES.O);
    expect(poseAtLetter(3)).toEqual(POSES.E);
    expect(poseAtLetter(-2)).toEqual(POSES.L);
    expect(poseAtLetter(99)).toEqual(POSES.E);
  });
});

describe('letterProgress (scroll → fractional letter)', () => {
  const centers = [500, 1500, 2500, 3500];

  it('clamps before the first and after the last section', () => {
    expect(letterProgress(centers, 0)).toBe(0);
    expect(letterProgress(centers, 500)).toBe(0);
    expect(letterProgress(centers, 3500)).toBe(3);
    expect(letterProgress(centers, 99999)).toBe(3);
  });

  it('is exactly letter i at each section centre', () => {
    expect(letterProgress(centers, 1500)).toBe(1);
    expect(letterProgress(centers, 2500)).toBe(2);
  });

  it('eases monotonically between neighbouring centres', () => {
    let prev = -1;
    for (let y = 500; y <= 3500; y += 100) {
      const v = letterProgress(centers, y);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
    // midway between centres = halfway through the ease
    expect(letterProgress(centers, 1000)).toBeCloseTo(smoothstep(0.5));
  });

  it('handles degenerate inputs', () => {
    expect(letterProgress([], 100)).toBe(0);
    expect(letterProgress([700], 100)).toBe(0);
    expect(letterProgress([700], 900)).toBe(0);
  });
});
