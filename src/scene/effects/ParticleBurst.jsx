import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const COUNT = 24;
const LIFE = 0.55;

/** One-shot particle burst at `position`; calls onDone when expired. */
export function ParticleBurst({ position, onDone }) {
  const ref = useRef();
  const age = useRef(0);

  const { geometry, velocities } = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(COUNT * 3);
    const vel = [];
    for (let i = 0; i < COUNT; i++) {
      pos.set(position, i * 3);
      const a = Math.random() * Math.PI * 2;
      const s = 1.2 + Math.random() * 1.8;
      vel.push([Math.cos(a) * s, Math.sin(a) * s + 0.8, (Math.random() - 0.5) * 0.6]);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return { geometry: geo, velocities: vel };
  }, [position]);

  useFrame((_, dt) => {
    age.current += dt;
    if (age.current > LIFE) { onDone?.(); return; }
    const pos = geometry.attributes.position;
    for (let i = 0; i < COUNT; i++) {
      velocities[i][1] -= 4.5 * dt; // gravity
      pos.setXYZ(
        i,
        pos.getX(i) + velocities[i][0] * dt,
        pos.getY(i) + velocities[i][1] * dt,
        pos.getZ(i) + velocities[i][2] * dt
      );
    }
    pos.needsUpdate = true;
    if (ref.current) ref.current.material.opacity = 1 - age.current / LIFE;
  });

  return (
    <points ref={ref} geometry={geometry} frustumCulled={false}>
      <pointsMaterial size={0.05} color="#ffd166" transparent opacity={1} depthWrite={false} />
    </points>
  );
}
