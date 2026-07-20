// PURE ASL fingerspelling pose math — no three/react imports (unit-testable),
// same pattern as physics/verletRope.js.
//
// A pose is plain numbers the scene lerps toward:
//   fingers: [index, middle, ring, pinky] — { curl 0..1, spread rad (z at knuckle) }
//   thumb:   { curl 0..1, out 0..1 }      — out: 0 = alongside palm, 1 = stuck out sideways
//   wrist:   { roll rad, pitch rad }      — whole-hand styling tilt

export const LETTERS = ['L', 'O', 'V', 'E'];

const f = (curl, spread = 0) => ({ curl, spread });

export const POSES = {
  // index up, thumb out flat — the corner of an "L"
  L: {
    fingers: [f(0, 0.08), f(1, -0.02), f(1, -0.06), f(1, -0.1)],
    thumb: { curl: 0.05, out: 1 },
    wrist: { roll: -0.08, pitch: 0 },
  },
  // every finger curved onto the thumb, ring shape
  O: {
    fingers: [f(0.62, -0.02), f(0.6, 0), f(0.6, 0.02), f(0.58, 0.05)],
    thumb: { curl: 0.55, out: 0.5 },
    wrist: { roll: 0.1, pitch: 0.22 },
  },
  // index + middle up and apart, rest folded
  V: {
    fingers: [f(0, 0.22), f(0, -0.16), f(1, -0.05), f(1, -0.1)],
    thumb: { curl: 0.75, out: 0.12 },
    wrist: { roll: 0, pitch: 0 },
  },
  // fingertips folded down over a tucked thumb, claw silhouette
  E: {
    fingers: [f(0.85, 0.02), f(0.85, 0), f(0.85, -0.02), f(0.82, -0.05)],
    thumb: { curl: 0.9, out: 0.05 },
    wrist: { roll: 0.05, pitch: 0.12 },
  },
};

// Exact at the endpoints so integer letterFloats reproduce POSES bit-for-bit.
export const lerp = (a, b, t) => (t <= 0 ? a : t >= 1 ? b : a + (b - a) * t);
const clamp01 = (t) => Math.min(1, Math.max(0, t));
export const smoothstep = (t) => {
  const c = clamp01(t);
  return c * c * (3 - 2 * c);
};

export function lerpPose(a, b, t) {
  return {
    fingers: a.fingers.map((fa, i) => ({
      curl: lerp(fa.curl, b.fingers[i].curl, t),
      spread: lerp(fa.spread, b.fingers[i].spread, t),
    })),
    thumb: {
      curl: lerp(a.thumb.curl, b.thumb.curl, t),
      out: lerp(a.thumb.out, b.thumb.out, t),
    },
    wrist: {
      roll: lerp(a.wrist.roll, b.wrist.roll, t),
      pitch: lerp(a.wrist.pitch, b.wrist.pitch, t),
    },
  };
}

/** Interpolated pose for a fractional letter index (0=L … 3=E, clamped). */
export function poseAtLetter(letterFloat) {
  const n = LETTERS.length;
  const cl = Math.min(Math.max(letterFloat, 0), n - 1);
  const i = Math.min(Math.floor(cl), n - 2);
  return lerpPose(POSES[LETTERS[i]], POSES[LETTERS[i + 1]], cl - i);
}

/**
 * Map a scroll position to a fractional letter index using section midpoints:
 * exactly letter i at centers[i], eased (smoothstep) between neighbours so each
 * letter holds crisp while its section fills the viewport.
 */
export function letterProgress(centers, y) {
  const n = centers.length;
  if (n === 0) return 0;
  if (y <= centers[0] || n === 1) return 0;
  if (y >= centers[n - 1]) return n - 1;
  let i = 0;
  while (i < n - 2 && y > centers[i + 1]) i++;
  const t = (y - centers[i]) / (centers[i + 1] - centers[i]);
  return i + smoothstep(t);
}
