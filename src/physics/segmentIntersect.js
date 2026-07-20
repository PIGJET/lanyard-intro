// Pure 2D geometry for cut detection. The camera is fixed and front-facing,
// so we hit-test in screen-projected 2D space (x, y). No Three.js here.

/** Proper segment-segment intersection test (p1->p2 vs p3->p4). */
export function segmentsIntersect(p1, p2, p3, p4) {
  const d1x = p2[0] - p1[0];
  const d1y = p2[1] - p1[1];
  const d2x = p4[0] - p3[0];
  const d2y = p4[1] - p3[1];
  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < 1e-12) return null; // parallel
  const t = ((p3[0] - p1[0]) * d2y - (p3[1] - p1[1]) * d2x) / denom;
  const u = ((p3[0] - p1[0]) * d1y - (p3[1] - p1[1]) * d1x) / denom;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { t, u, point: [p1[0] + t * d1x, p1[1] + t * d1y] };
}

/** Shortest distance from point p to segment a->b. */
export function pointSegmentDistance(p, a, b) {
  const abx = b[0] - a[0];
  const aby = b[1] - a[1];
  const apx = p[0] - a[0];
  const apy = p[1] - a[1];
  const lenSq = abx * abx + aby * aby;
  const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, (apx * abx + apy * aby) / lenSq));
  const cx = a[0] + t * abx - p[0];
  const cy = a[1] + t * aby - p[1];
  return Math.sqrt(cx * cx + cy * cy);
}

/**
 * Test a swipe step (prev cursor pos -> current cursor pos, in 2D) against a
 * list of rope segments [[index, a2d, b2d], ...].
 *
 * Returns { index, point } of the first crossed segment, or the nearest
 * segment within `hitRadius` (fat-finger fallback for fast/short swipes),
 * or null.
 */
export function findCut(swipeA, swipeB, segments, hitRadius = 0) {
  // 1) exact crossing wins
  for (const [index, a, b] of segments) {
    const hit = segmentsIntersect(swipeA, swipeB, a, b);
    if (hit) return { index, point: hit.point };
  }
  // 2) fallback: swipe endpoint grazes within hitRadius
  if (hitRadius > 0) {
    let best = null;
    for (const [index, a, b] of segments) {
      const d = pointSegmentDistance(swipeB, a, b);
      if (d <= hitRadius && (!best || d < best.d)) {
        best = { index, point: [swipeB[0], swipeB[1]], d };
      }
    }
    if (best) return { index: best.index, point: best.point };
  }
  return null;
}
