import { useMemo, useRef } from 'react';

const REDUCED_MOTION =
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { step, getRuns, applyWind } from '../physics/verletRope.js';

// Tube renderer: preallocated buffers, zero per-frame allocation.
// Each frame we rebuild rings along every contiguous run of the rope
// (getRuns splits at cuts) using parallel-transport frames, which avoids
// the twisting artifacts a naive lookAt-per-ring approach produces.

const MAX_RINGS = 64;   // total rings across all runs (segments+1 = 19/rope)
const RADIAL = 8;       // vertices per ring
const FLATTEN = 0.4;    // cross-section is an ellipse: wide face toward camera, like a strap
const MAX_VERTS = MAX_RINGS * RADIAL;
const MAX_INDICES = (MAX_RINGS - 1) * RADIAL * 6;

// scratch vectors (module-level: shared, never allocated in the loop)
const _tan = new THREE.Vector3();
const _nor = new THREE.Vector3();
const _bin = new THREE.Vector3();
const _tmp = new THREE.Vector3();

function writeTube(geometry, runs, radius) {
  const pos = geometry.attributes.position;
  const nrm = geometry.attributes.normal;
  const idx = geometry.index;
  let vi = 0; // ring-vertex cursor
  let ii = 0; // index cursor

  for (const run of runs) {
    if (vi + run.length * RADIAL > MAX_VERTS) break;
    const ringStart = vi;

    for (let i = 0; i < run.length; i++) {
      const p = run[i];
      const prev = run[Math.max(0, i - 1)];
      const next = run[Math.min(run.length - 1, i + 1)];
      _tan.set(next[0] - prev[0], next[1] - prev[1], next[2] - prev[2]);
      if (_tan.lengthSq() < 1e-12) _tan.set(0, -1, 0);
      _tan.normalize();

      if (i === 0) {
        // seed a normal perpendicular to the first tangent
        _tmp.set(1, 0, 0);
        if (Math.abs(_tan.x) > 0.9) _tmp.set(0, 0, 1);
        _nor.crossVectors(_tan, _tmp).normalize();
      } else {
        // parallel transport: strip the tangent component, renormalize
        _nor.sub(_tmp.copy(_tan).multiplyScalar(_nor.dot(_tan)));
        if (_nor.lengthSq() < 1e-12) {
          _tmp.set(1, 0, 0);
          if (Math.abs(_tan.x) > 0.9) _tmp.set(0, 0, 1);
          _nor.crossVectors(_tan, _tmp);
        }
        _nor.normalize();
      }
      _bin.crossVectors(_tan, _nor);

      for (let r = 0; r < RADIAL; r++) {
        const a = (r / RADIAL) * Math.PI * 2;
        const ca = Math.cos(a) * FLATTEN; // thin along the normal (depth)
        const sa = Math.sin(a);           // wide along the binormal (strap face)
        const ox = ca * _nor.x + sa * _bin.x;
        const oy = ca * _nor.y + sa * _bin.y;
        const oz = ca * _nor.z + sa * _bin.z;
        // ellipse surface normal: component-wise inverse-scaled, renormalized
        const ex = (Math.cos(a) / FLATTEN) * _nor.x + sa * _bin.x;
        const ey = (Math.cos(a) / FLATTEN) * _nor.y + sa * _bin.y;
        const ez = (Math.cos(a) / FLATTEN) * _nor.z + sa * _bin.z;
        const el = Math.sqrt(ex * ex + ey * ey + ez * ez) || 1;
        pos.setXYZ(vi, p[0] + ox * radius, p[1] + oy * radius, p[2] + oz * radius);
        nrm.setXYZ(vi, ex / el, ey / el, ez / el);
        vi++;
      }
    }

    for (let i = 0; i < run.length - 1; i++) {
      for (let r = 0; r < RADIAL; r++) {
        const a = ringStart + i * RADIAL + r;
        const b = ringStart + i * RADIAL + ((r + 1) % RADIAL);
        const c = a + RADIAL;
        const d = b + RADIAL;
        idx.setX(ii++, a); idx.setX(ii++, c); idx.setX(ii++, b);
        idx.setX(ii++, b); idx.setX(ii++, c); idx.setX(ii++, d);
      }
    }
  }

  geometry.setDrawRange(0, ii);
  pos.needsUpdate = true;
  nrm.needsUpdate = true;
  idx.needsUpdate = true;
}

/**
 * Renders + simulates one Verlet rope as a solid tube.
 *
 * Props:
 *  - rope: verletRope instance (owned by BadgeRig so it survives re-renders)
 *  - getEndPin(): () => [x,y,z] | null — badge attachment point while intact
 *  - onAfterStep(rope): coupling hook (BadgeRig pulls the badge toward the tail)
 */
export function Rope({ rope, getEndPin, onAfterStep }) {
  const meshRef = useRef();

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_VERTS * 3), 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(MAX_VERTS * 3), 3));
    geo.setIndex(new THREE.BufferAttribute(new Uint16Array(MAX_INDICES), 1));
    geo.attributes.position.setUsage(THREE.DynamicDrawUsage);
    geo.attributes.normal.setUsage(THREE.DynamicDrawUsage);
    geo.index.setUsage(THREE.DynamicDrawUsage);
    return geo;
  }, []);

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 1 / 30); // clamp frame spikes
    const sub = 2;
    for (let i = 0; i < sub; i++) {
      applyWind(rope, clock.elapsedTime, REDUCED_MOTION ? 0 : CONFIG.rope.windStrength);
      step(rope, dt / sub, CONFIG.rope.iterations, getEndPin ? getEndPin() : null);
    }
    onAfterStep?.(rope);
    writeTube(geometry, getRuns(rope), CONFIG.rope.thickness);
  });

  return (
    <mesh ref={meshRef} geometry={geometry} frustumCulled={false}>
      {/* matte woven-strap look: dark navy, high roughness, faint sheen from env */}
      <meshStandardMaterial
        color="#2b3552"
        roughness={0.88}
        metalness={0.04}
        envMapIntensity={0.5}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
