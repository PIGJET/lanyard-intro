import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { activeSegments } from '../physics/verletRope.js';
import { findCut } from '../physics/segmentIntersect.js';

const _v = new THREE.Vector3();

/**
 * Cut input layer. Uses Pointer Events so mouse drag and touch swipe share
 * one code path (spec §4, §8). Each pointermove step (prev → current) is
 * tested against every registered rope's active segments, projected to
 * screen space with the current camera.
 *
 * `ropesRef.current` is a Map<slot, { rope, onCut }> maintained by Scene.
 */
export function CutDetector({ ropesRef }) {
  const { camera, gl, size } = useThree();
  const last = useRef(null); // last pointer position; null = path broken

  useEffect(() => {
    const el = gl.domElement;

    const toScreen = (worldPos) => {
      _v.set(worldPos[0], worldPos[1], worldPos[2]).project(camera);
      return [((_v.x + 1) / 2) * size.width, ((1 - _v.y) / 2) * size.height];
    };

    const worldHitRadiusPx = () => {
      // convert world hitRadius to pixels at z=0 (fixed camera): project two points
      const a = toScreen([0, 0, 0]);
      const b = toScreen([CONFIG.rope.hitRadius, 0, 0]);
      return Math.abs(b[0] - a[0]);
    };

    // Cutting needs only cursor motion — no button held (mouse glides through
    // the rope; touch still works because pointermove only fires mid-swipe).
    // Breaking the path on down/leave/cancel prevents a phantom swipe segment
    // between where one gesture ended and the next began.
    const onBreak = () => (last.current = null);
    const onDown = (e) => (last.current = [e.clientX, e.clientY]);

    const onMove = (e) => {
      const cur = [e.clientX, e.clientY];
      const prev = last.current;
      if (!prev) {
        last.current = cur;
        return;
      }
      // Accumulate micro-jitter instead of resetting, so slow deliberate
      // motion still forms a real swipe segment eventually.
      if (Math.hypot(cur[0] - prev[0], cur[1] - prev[1]) < 2) return;
      last.current = cur;

      const radiusPx = worldHitRadiusPx();
      for (const [, entry] of ropesRef.current) {
        const segs3d = activeSegments(entry.rope);
        const segs2d = segs3d.map(([i, a, b]) => [i, toScreen(a), toScreen(b)]);
        const hit = findCut(prev, cur, segs2d, radiusPx);
        if (hit) {
          // unproject hit point back to world at z=0 for effects
          const ndcX = (hit.point[0] / size.width) * 2 - 1;
          const ndcY = -((hit.point[1] / size.height) * 2 - 1);
          _v.set(ndcX, ndcY, 0.5).unproject(camera);
          const dir = _v.sub(camera.position).normalize();
          const t = -camera.position.z / dir.z;
          const world = [
            camera.position.x + dir.x * t,
            camera.position.y + dir.y * t,
            0,
          ];
          // swipe direction → world angle (screen y is down, world y is up)
          const angle = Math.atan2(-(cur[1] - prev[1]), cur[0] - prev[0]);
          entry.onCut(hit.index, world, angle);
          // one cut per move-step per rope max; keep checking other ropes
        }
      }
    };

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onBreak);
    window.addEventListener('pointercancel', onBreak);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onBreak);
      window.removeEventListener('pointercancel', onBreak);
    };
  }, [camera, gl, size, ropesRef]);

  return null;
}
