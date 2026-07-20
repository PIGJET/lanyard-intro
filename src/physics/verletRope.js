// Pure Verlet-integration rope. No Three.js, no React — fully unit-testable.
//
// A rope is a chain of points connected by distance constraints.
// - points[0] is pinned to an anchor.
// - The last point is "driven": each frame the caller may read its position to
//   drag a Rapier rigid body (kinematic-ish coupling), or pin it to the body.
// - severAt(i) breaks the constraint between point i and i+1, splitting the
//   rope into an anchored upper part and a free-falling lower part.

export function createRope({
  anchor,
  length,
  segments,
  gravity = -9.8,
  damping = 0.985,
  initialSpacingFactor = 1,
}) {
  const segLen = length / segments;
  // initialSpacingFactor < 1 spawns the rope gathered near the anchor; since
  // constraints only resist stretch, it unfurls downward under gravity —
  // the "new badge drops in from the top" effect.
  const spacing = segLen * initialSpacingFactor;
  const points = [];
  for (let i = 0; i <= segments; i++) {
    const y = anchor[1] - spacing * i;
    points.push({
      pos: [anchor[0], y, anchor[2]],
      prev: [anchor[0], y, anchor[2]],
      pinned: i === 0,
    });
  }
  // constraints[i] connects points[i] <-> points[i+1]; null = severed
  const constraints = [];
  for (let i = 0; i < segments; i++) constraints.push({ restLength: segLen, broken: false });

  return {
    points,
    constraints,
    anchor: [...anchor],
    gravity,
    damping,
    segLen,
    lastDt: 0,
    // Per-rope random phase so multiple ropes never sway in sync (they share
    // the same "room wind" but each catches it differently).
    windSeed: Math.random() * 1000,
  };
}

export function setAnchor(rope, x, y, z) {
  rope.anchor[0] = x;
  rope.anchor[1] = y;
  rope.anchor[2] = z;
}

/** Advance the simulation by dt seconds. iterations = constraint solver passes. */
export function step(rope, dt, iterations = 6, endPin = null) {
  const { points, constraints, gravity, damping } = rope;
  const dt2 = dt * dt;
  rope.lastDt = dt; // callers derive point velocities as (pos - prev) / lastDt

  // Integrate
  for (const p of points) {
    if (p.pinned) continue;
    const vx = (p.pos[0] - p.prev[0]) * damping;
    const vy = (p.pos[1] - p.prev[1]) * damping;
    const vz = (p.pos[2] - p.prev[2]) * damping;
    p.prev[0] = p.pos[0];
    p.prev[1] = p.pos[1];
    p.prev[2] = p.pos[2];
    p.pos[0] += vx;
    p.pos[1] += vy + gravity * dt2;
    p.pos[2] += vz;
  }

  // Pin head to anchor
  const head = points[0];
  head.pos[0] = rope.anchor[0];
  head.pos[1] = rope.anchor[1];
  head.pos[2] = rope.anchor[2];
  head.prev[0] = rope.anchor[0];
  head.prev[1] = rope.anchor[1];
  head.prev[2] = rope.anchor[2];

  // Optionally pin tail to an external body position (badge attachment point)
  if (endPin) {
    const tail = points[points.length - 1];
    tail.pos[0] = endPin[0];
    tail.pos[1] = endPin[1];
    tail.pos[2] = endPin[2];
  }

  // Satisfy constraints
  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < constraints.length; i++) {
      const c = constraints[i];
      if (c.broken) continue;
      const a = points[i];
      const b = points[i + 1];
      let dx = b.pos[0] - a.pos[0];
      let dy = b.pos[1] - a.pos[1];
      let dz = b.pos[2] - a.pos[2];
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-8;
      if (dist <= c.restLength) continue; // a strap resists stretch, never compression
      const diff = (dist - c.restLength) / dist;
      const aw = a.pinned ? 0 : 0.5;
      const bw = b.pinned ? 0 : 0.5;
      const total = aw + bw || 1;
      dx *= diff;
      dy *= diff;
      dz *= diff;
      a.pos[0] += dx * (aw / total) * 2 * 0.5;
      a.pos[1] += dy * (aw / total) * 2 * 0.5;
      a.pos[2] += dz * (aw / total) * 2 * 0.5;
      b.pos[0] -= dx * (bw / total) * 2 * 0.5;
      b.pos[1] -= dy * (bw / total) * 2 * 0.5;
      b.pos[2] -= dz * (bw / total) * 2 * 0.5;
    }
    if (endPin) {
      const tail = points[points.length - 1];
      tail.pos[0] = endPin[0];
      tail.pos[1] = endPin[1];
      tail.pos[2] = endPin[2];
    }
  }
}

/** Instantaneous velocity of the tail point, from the last Verlet step. */
export function tailVelocity(rope) {
  const tail = rope.points[rope.points.length - 1];
  const dt = rope.lastDt || 1 / 60;
  return [
    (tail.pos[0] - tail.prev[0]) / dt,
    (tail.pos[1] - tail.prev[1]) / dt,
    (tail.pos[2] - tail.prev[2]) / dt,
  ];
}

/** Break the constraint between points[i] and points[i+1]. Returns true if it broke something new. */
export function severAt(rope, i) {
  if (i < 0 || i >= rope.constraints.length) return false;
  if (rope.constraints[i].broken) return false;
  rope.constraints[i].broken = true;
  return true;
}

/** Is the rope still connected from anchor (0) to tail (last point)? */
export function isIntact(rope) {
  return rope.constraints.every((c) => !c.broken);
}

/** Index of the first broken constraint, or -1. */
export function firstBreak(rope) {
  return rope.constraints.findIndex((c) => c.broken);
}

/**
 * Ambient wind for idle sway (spec §2: badges swing gently, never static).
 * Injects tiny positional offsets — in Verlet, a position nudge IS a velocity
 * impulse. Two out-of-phase sines per point avoid a metronome look; effect
 * scales toward the free end (fraction f) like a real hanging strap.
 */
export function applyWind(rope, time, strength = 1) {
  if (strength === 0) return;
  const pts = rope.points;
  const n = pts.length - 1;
  const s = rope.windSeed || 0;
  // Slow breathing envelope: gusts build and die per rope, so two ropes react
  // to the "same room" at different moments instead of metronoming together.
  const gustEnv =
    0.3 + 0.7 * (0.5 + 0.5 * Math.sin(time * 0.29 + s) * Math.sin(time * 0.11 + s * 1.7));
  for (let i = 1; i <= n; i++) {
    const p = pts[i];
    if (p.pinned) continue;
    // Bow the middle of the strap (zero at both ends): the whole rig swings as
    // a pendulum, but the tail segment stays smooth so the badge never kinks.
    const f = Math.sin((i / n) * Math.PI);
    const gust =
      Math.sin(time * 1.1 + s + i * 0.6) +
      0.6 * Math.sin(time * 2.3 + s * 2.1 + i * 1.1) +
      0.3 * Math.sin(time * 3.9 + s * 0.7);
    p.pos[0] += gust * gustEnv * strength * f * 0.0006;
    p.pos[2] += Math.sin(time * 0.8 + s * 1.3 + i) * gustEnv * strength * f * 0.0003;
  }
}

/**
 * One-shot lateral velocity kick, scaled toward the free end — used to
 * randomize each drop so no two spawns settle the same way (spec: randomized
 * initial conditions per mount).
 */
export function applyKick(rope, vx, vz = 0) {
  const pts = rope.points;
  const n = pts.length - 1;
  for (let i = 1; i <= n; i++) {
    const p = pts[i];
    if (p.pinned) continue;
    const f = i / n;
    p.prev[0] = p.pos[0] - (vx * f) / 60;
    p.prev[2] = p.pos[2] - (vz * f) / 60;
  }
}

/**
 * Contiguous unbroken chains of point positions, split at broken constraints.
 * An intact rope yields one run; a single cut yields two (anchored stub +
 * free-falling tail). Runs shorter than 2 points are dropped (nothing to draw).
 */
export function getRuns(rope) {
  const runs = [];
  let cur = [rope.points[0].pos];
  for (let i = 0; i < rope.constraints.length; i++) {
    if (rope.constraints[i].broken) {
      if (cur.length > 1) runs.push(cur);
      cur = [rope.points[i + 1].pos];
    } else {
      cur.push(rope.points[i + 1].pos);
    }
  }
  if (cur.length > 1) runs.push(cur);
  return runs;
}

/**
 * Active (unbroken) segments as [i, aPos, bPos] tuples — used for both
 * rendering and hit-testing so the two can never disagree.
 */
export function activeSegments(rope) {
  const out = [];
  for (let i = 0; i < rope.constraints.length; i++) {
    if (rope.constraints[i].broken) continue;
    out.push([i, rope.points[i].pos, rope.points[i + 1].pos]);
  }
  return out;
}
