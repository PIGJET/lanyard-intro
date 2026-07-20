// Every tunable knob for the intro game lives here.
// Values are in world units unless noted.

export const CONFIG = {
  rope: {
    segments: 18,          // Verlet points = segments + 1
    iterations: 6,         // constraint solver passes per frame
    damping: 0.985,        // velocity retention per step (1 = none)
    gravity: -9.8,
    // Rest length is derived from viewport: ropeLength = viewportWorldHeight * lengthFactor
    lengthFactor: 0.34,
    thickness: 0.055,      // strap half-width (cross-section is flattened to read as a ribbon)
    hitRadius: 0.14,       // fat hitbox around each segment for cut detection
    windStrength: 1,       // ambient idle-sway intensity (0 = off)
    minCutIndex: 2,        // can't cut the top 2 segments (feels unfair / anchor pop)
  },

  badge: {
    width: 0.9,
    height: 1.35,
    depth: 0.035,
    cornerRadius: 0.07,
    mass: 0.35,
    // horizontal offsets of the two hang points, as fraction of viewport world width
    hangX: [-0.22, 0.22],
    respawnDelayMs: 650,   // new badge drops in after a cut
    killY: -1.5,           // world-Y margin below viewport bottom where fallen badges despawn
  },

  game: {
    skipAppearsAt: 3,      // cuts before Skip button fades in
    unlockAt: 10,          // cuts to unlock the portfolio CTA
    easterEggAt: 100,
    messageChance: 0.35,   // probability a cut spawns an encouragement message
    messageMinGap: 2,      // min cuts between messages
  },

  camera: {
    fov: 42,
    z: 7,
  },
};
