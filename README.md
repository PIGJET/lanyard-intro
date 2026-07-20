# Lanyard-Cutting Portfolio Intro — Scaffold

Physics mini-game gate for a portfolio: swipe to cut lanyards on hanging ID badges. Unlock at 10 cuts (or skip), easter egg at 100.

## Run it

```bash
npm install
npm run dev     # local dev server
npm test        # 26 unit tests (physics, geometry, game rules)
npm run build   # production build
```

## Architecture

The core design decision: **all physics and geometry math is pure JS with zero
Three.js/React imports**, so the trickiest parts of this project are unit-tested
headlessly. React Three Fiber components are thin wrappers.

```
src/
├── config.js                  # every tunable (rope, badge, thresholds, camera)
├── physics/
│   ├── verletRope.js          # PURE Verlet rope: create/step/sever/activeSegments
│   └── segmentIntersect.js    # PURE 2D swipe-vs-segment crossing + fat-hitbox fallback
├── state/gameStore.js         # zustand; session-only (spec §6: NO persistence)
├── scene/
│   ├── Scene.jsx              # Canvas, lights, <Physics>, rope registry, effect pool
│   ├── BadgeRig.jsx           # rope↔Rapier coupling, cut, despawn, respawn from top
│   ├── Rope.jsx               # runs sim in useFrame, renders active segments
│   ├── Badge.jsx              # rounded card + canvas-texture face + clearcoat laminate
│   ├── CutDetector.jsx        # Pointer Events (mouse+touch unified) → screen-space test
│   ├── Ninja.jsx              # voxel ninja: walk in → turn → shush → walk out (cut 100)
│   └── effects/               # ParticleBurst, SliceMark (one-shot, self-removing)
├── ui/
│   ├── Hud.jsx                # counter pop, skip fade-in (cut 3), CTA (cut 10), toasts
│   └── messages.js            # randomized pool + milestone lines, no immediate repeats
├── audio/sounds.js            # placeholder WebAudio synth snip/shush; URL-swap ready
└── portfolio/                 # the destination page (after Enter / Skip)
    ├── Portfolio.jsx          # brutalist gray page: hero → about → works → stack
    ├── content.js             # ALL editable copy (name, projects, stack, socials)
    ├── handPoses.js           # PURE ASL pose math: L/O/V/E poses, lerp, scroll→letter
    ├── Hand.jsx               # procedural cartoon glove; damps joints toward pose
    ├── HandScene.jsx          # fixed background canvas behind the content
    └── portfolio.css          # scoped styles (own scroll container; body untouched)
```

### Portfolio page (M3)

Scrolling drives a procedural glove hand (background canvas) through ASL
fingerspelling **L → O → V → E** — one letter per section, eased between section
midpoints (`letterProgress`, unit-tested). The hand tilts toward the cursor and
idles with a slow bob (both disabled under `prefers-reduced-motion`). A fixed
right-rail indicator shows which letter is active. The stack section is a
sliding-window marquee (two counter-scrolling rows; pauses on hover; degrades
to a hand-scrollable strip under reduced motion). All copy lives in
`src/portfolio/content.js` — edit that file, nothing else, to make it yours.

### Key mechanics, mapped to spec

| Spec | Where |
|---|---|
| Verlet rope, not joint chains (§1) | `physics/verletRope.js`, sub-stepped in `Rope.jsx` |
| Rope tail ↔ Rapier badge (§1) | `BadgeRig`: tail pinned to badge top while intact; spring pulls badge under tail; on cut, badge goes free-dynamic with impulse+torque |
| Viewport-proportional hang (§2, §8) | `config.rope.lengthFactor` × R3F `viewport`; anchors update on resize |
| Laminate look (§3) | `Badge.jsx`: base card + printed canvas face + oversized clearcoat/sheen shell |
| Hitbox-crossing cut (§4) | `CutDetector` projects active segments to screen px, exact crossing first, fat-radius graze fallback |
| Burst + slice + audio on cut (§4) | `Scene.handleCut` → effects pool + `playCut()` |
| Fall & despawn, respawn from top (§4) | `BadgeRig`: kill-Y freeze + generation remount dropping from above viewport |
| Counter / skip / messages / unlock (§5) | `Hud.jsx` + `gameStore.js` (all thresholds in `config.game`) |
| 100-cut ninja, once per session (§5) | `gameStore.easterEggPlayed` + `Ninja.jsx` phase timeline |
| No persistence (§6) | verified: `grep localStorage src/` is clean; test asserts fresh state |

## Review & test results

- **33/33 unit tests pass** (rope creation/settling/anchor-follow/sever/split-fall,
  intersection math incl. degenerate cases, progression/skip/easter-egg-once/message-gap).
- **Production build passes** (`vite build`, 636 modules).
- **Storage-API grep clean** — no localStorage/sessionStorage/cookies anywhere.

### Known items flagged in self-review (deliberate scaffold trade-offs)

1. ~~Rope rendering~~ **DONE (M2):** rope now renders as a solid tube — preallocated
   buffers, zero per-frame allocation, parallel-transport frames (no twist), splits
   correctly at cuts via the pure `getRuns()` helper (unit-tested incl. edge cases).
2. ~~Bundle~~ **DONE (M4):** entry chunk is now 10 KB (4.4 KB gzip); react/three/rapier
   split into parallel, long-cacheable chunks; Scene is lazy-mounted behind an instant
   loader shell. Remaining option: swap `@dimforge/rapier3d-compat` (base64-inlined
   WASM, 761 KB gzip) for the streaming-WASM package to cut it roughly in half.
3. **Badge↔rope coupling** is a one-way spring (rope drives badge). Idle sway now
   comes from a pure `applyWind()` ambient force (unit-tested for 20-sim-second
   stability, disabled under prefers-reduced-motion). If badge inertia should tug
   the rope visibly, add the reverse impulse in `onAfterStep`.
4. **Ninja is intentionally minimal** — phase timeline + pivots are in place, so
   polishing the model/gait is isolated to `Ninja.jsx`.
5. ~~Slice mark~~ **DONE (M2):** slash streak is now aligned to the real swipe
   vector, threaded from `CutDetector` through the cut event.

## Roadmap

- **M1 (this scaffold):** architecture, physics core + tests, playable loop end-to-end.
- **M2 (feel):** ~~tube rope rendering~~ ✓, ~~swipe-aligned slice mark~~ ✓,
  ~~idle-sway~~ ✓ (ambient wind), ~~badge tumble tuning~~ ✓ (damping + torque),
  cut sound variation ✓ (pitch jitter built into `sounds.js`). Remaining: mobile QA
  on real devices (touch path is implemented; needs hands-on verification).
- **M3 (content):** ~~portfolio page~~ ✓ (ASL hand + brutalist layout + stack marquee;
  copy is placeholder — edit `src/portfolio/content.js`). Remaining: real badge
  photos/names via `Badge content` prop, real audio files via `PLACEHOLDER_URLS`.
- **M4 (polish):** ~~code-split~~ ✓ (vendor chunks + lazy Scene), easter-egg animation
  polish, full a11y audit (reduced-motion honored in CSS + wind), cross-browser touch
  testing.
