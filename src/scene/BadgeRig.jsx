import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { RigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { createRope, setAnchor, severAt, tailVelocity, applyKick } from '../physics/verletRope.js';
import { useGameStore } from '../state/gameStore.js';
import { Rope } from './Rope.jsx';
import { Badge, PLACEHOLDER_BADGES } from './Badge.jsx';

// Coupling model (the load-bearing decision of this file):
//  - While hanging, the Verlet rope is the source of truth. The badge is a
//    kinematicPosition body glued to the rope tail each frame — no springs,
//    no feedback loop, cannot drift.
//  - While the user drags the badge, the badge leads (chases the pointer)
//    and the rope tail is pinned to it; on release the rope resumes leading,
//    inheriting the drag velocity for a natural fling.
//  - On cut, the badge flips to a dynamic body seeded with the rope tail's
//    velocity, and the severed lower rope run has its tail pinned to the
//    (now tumbling) badge so they fall as one piece.
//  - A cut unit keeps living until its badge exits the bottom of the screen;
//    the replacement unit spawns independently, so falling badges never pop.

let nextUnitId = 0;

const _q = new THREE.Quaternion();
const _qTarget = new THREE.Quaternion();
const _off = new THREE.Vector3();
const Z_AXIS = new THREE.Vector3(0, 0, 1);
const IDENTITY_Q = new THREE.Quaternion();
const BADGE_ATTACH_GAP = 0.02; // rope tail sits this far above the card edge

/**
 * One hang slot. Owns the list of live units (at most one hanging + any
 * still-falling cut ones) and respawns a fresh unit after each cut.
 */
export function BadgeRig({ slot, registerRope, onCut }) {
  const [units, setUnits] = useState(() => [++nextUnitId]);
  const timers = useRef([]);

  const spawnReplacement = useCallback(() => {
    const t = setTimeout(() => {
      setUnits((u) => [...u, ++nextUnitId]);
    }, CONFIG.badge.respawnDelayMs);
    timers.current.push(t);
  }, []);

  const removeUnit = useCallback((id) => {
    setUnits((u) => u.filter((x) => x !== id));
  }, []);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  return units.map((id) => (
    <BadgeUnit
      key={id}
      unitKey={`${slot}:${id}`}
      slot={slot}
      registerRope={registerRope}
      onCut={onCut}
      onSevered={spawnReplacement}
      onGone={() => removeUnit(id)}
    />
  ));
}

/** One rope + one badge, from drop-in to off-screen despawn. */
function BadgeUnit({ unitKey, slot, registerRope, onCut, onSevered, onGone }) {
  const { viewport, pointer } = useThree();
  const bodyRef = useRef();
  const [cut, setCut] = useState(false);
  const cutRef = useRef(false);
  const dragRef = useRef(false);
  const goneRef = useRef(false);
  const releaseVel = useRef([0, 0, 0]);
  const smoothQ = useRef(new THREE.Quaternion());
  const retract = useRef(0); // 0 = hanging in place, 1 = pulled above the screen

  const anchorX = viewport.width * CONFIG.badge.hangX[slot];
  const anchorY = viewport.height / 2 + 0.2; // just above top edge
  const ropeLength = viewport.height * CONFIG.rope.lengthFactor;

  const rope = useMemo(
    () =>
      createRope({
        anchor: [anchorX, anchorY, 0],
        length: ropeLength,
        segments: CONFIG.rope.segments,
        gravity: CONFIG.rope.gravity,
        damping: CONFIG.rope.damping,
        // gathered at the anchor → unfurls in from the top; spacing varies
        // per spawn so no two drops read identical
        initialSpacingFactor: 0.1 + Math.random() * 0.08,
      }),
    [] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Randomized drop (spec: never settles the same way twice) — a lateral
  // velocity kick whose strength/direction differ every mount.
  useEffect(() => {
    applyKick(rope, (Math.random() - 0.5) * 2.4, (Math.random() - 0.5) * 0.8);
  }, [rope]);

  // Register with the CutDetector while intact.
  useEffect(() => {
    if (cut) return undefined;
    const handleCut = (segIndex, worldPoint, swipeAngle) => {
      if (cutRef.current || dragRef.current) return false;
      if (useGameStore.getState().easterEggActive) return false; // stage is the ninja's
      if (segIndex < CONFIG.rope.minCutIndex) return false;
      if (!severAt(rope, segIndex)) return false;
      cutRef.current = true;
      releaseVel.current = tailVelocity(rope);
      setCut(true); // flips the RigidBody to dynamic
      onCut?.(worldPoint, swipeAngle);
      onSevered?.();
      return true;
    };
    return registerRope(unitKey, rope, handleCut);
  }, [rope, registerRope, unitKey, onCut, onSevered, cut]);

  // On release, hand the rope tail's momentum to the now-dynamic body,
  // plus a nudge so the tumble reads dramatic. (Child effects run before
  // parent effects, so the RigidBody has already switched to dynamic here.)
  useEffect(() => {
    if (!cut) return;
    const body = bodyRef.current;
    if (!body) return;
    const [vx, vy, vz] = releaseVel.current;
    body.setLinvel({ x: vx, y: vy, z: vz }, true);
    body.applyImpulse(
      { x: (Math.random() - 0.5) * 0.4, y: -0.2, z: (Math.random() - 0.5) * 0.2 },
      true
    );
    body.applyTorqueImpulse(
      { x: (Math.random() - 0.5) * 0.05, y: (Math.random() - 0.5) * 0.05, z: (Math.random() - 0.5) * 0.14 },
      true
    );
  }, [cut]);

  // Drag release can happen off the card (fast fling), so listen globally.
  useEffect(() => {
    const release = () => (dragRef.current = false);
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    return () => {
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
    };
  }, []);

  // The rope tail rides the badge whenever the badge leads (drag or fall).
  const getEndPin = useCallback(() => {
    if (!cutRef.current && !dragRef.current) return null; // hanging: rope leads
    const body = bodyRef.current;
    if (!body) return null;
    const p = body.translation();
    _q.copy(body.rotation());
    _off.set(0, CONFIG.badge.height / 2 + BADGE_ATTACH_GAP, 0).applyQuaternion(_q);
    return [p.x + _off.x, p.y + _off.y, p.z + _off.z];
  }, []);

  // Per-frame badge placement while kinematic (hanging or dragged).
  const onAfterStep = useCallback(
    (r) => {
      const body = bodyRef.current;
      if (!body || cutRef.current) return;

      if (dragRef.current) {
        // Badge chases the pointer; rope follows via getEndPin.
        const tx = pointer.x * (viewport.width / 2);
        const ty = pointer.y * (viewport.height / 2);
        const p = body.translation();
        body.setNextKinematicTranslation({
          x: p.x + (tx - p.x) * 0.35,
          y: p.y + (ty - p.y) * 0.35,
          z: 0,
        });
        smoothQ.current.slerp(IDENTITY_Q, 0.12); // ease upright while held
        body.setNextKinematicRotation(smoothQ.current);
        return;
      }

      // Hanging: glue the badge under the rope tail. Tilt follows the overall
      // anchor→tail pendulum direction (clamped + slerp-smoothed), which reads
      // as natural swing — per-segment angles are far too twitchy.
      const n = r.points.length - 1;
      const tail = r.points[n].pos;
      const head = r.points[0].pos;
      const dx = tail[0] - head[0];
      const dy = Math.min(tail[1] - head[1], -1e-6); // hanging ⇒ tail below anchor
      const tilt = THREE.MathUtils.clamp(Math.atan2(dx, -dy), -0.6, 0.6);
      _qTarget.setFromAxisAngle(Z_AXIS, tilt);
      smoothQ.current.slerp(_qTarget, 0.18);
      _off
        .set(0, -(CONFIG.badge.height / 2 + BADGE_ATTACH_GAP), 0)
        .applyQuaternion(smoothQ.current);
      body.setNextKinematicTranslation({
        x: tail[0] + _off.x,
        y: tail[1] + _off.y,
        z: tail[2] + _off.z,
      });
      body.setNextKinematicRotation(smoothQ.current);
    },
    [viewport, pointer]
  );

  const easterEggActive = useGameStore((s) => s.easterEggActive);

  useFrame((_, dt) => {
    // While the ninja owns the stage, hoist the whole rig above the screen;
    // lower it back when the show ends. Anchor motion also covers resize.
    // Restore is slower than retract: the constraint solver can only pull the
    // slack rope down so fast before it visibly stretches.
    const target = easterEggActive && !cutRef.current ? 1 : 0;
    const rate = target > retract.current ? 2.2 : 1.0;
    retract.current += (target - retract.current) * Math.min(1, dt * rate);
    const lift = retract.current * (viewport.height + ropeLength);
    setAnchor(rope, anchorX, anchorY + lift, 0);

    // Despawn cut badges once fully below the viewport (spec §4: no pile-up).
    if (!cutRef.current || goneRef.current) return;
    const body = bodyRef.current;
    if (!body) return;
    if (body.translation().y < -viewport.height / 2 + CONFIG.badge.killY) {
      goneRef.current = true;
      onGone?.();
    }
  });

  const content = PLACEHOLDER_BADGES[slot % PLACEHOLDER_BADGES.length];

  return (
    <group>
      <Rope rope={rope} getEndPin={getEndPin} onAfterStep={onAfterStep} />
      <RigidBody
        ref={bodyRef}
        type={cut ? 'dynamic' : 'kinematicPosition'}
        position={[anchorX, anchorY, 0]}
        colliders="cuboid"
        mass={CONFIG.badge.mass}
        linearDamping={0.15}
        angularDamping={0.45}
        canSleep={false}
      >
        <group
          onPointerDown={(e) => {
            if (cutRef.current) return;
            e.stopPropagation();
            dragRef.current = true;
            if (typeof window !== 'undefined') window.__lastGrab = unitKey; // debug/testing hook
          }}
          onPointerUp={() => (dragRef.current = false)}
        >
          <Badge content={content} />
        </group>
      </RigidBody>
    </group>
  );
}
