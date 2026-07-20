import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';

const LIFE = 0.28;

/** Brief slash streak at the cut point, aligned to the actual swipe direction. */
export function SliceMark({ position, angle, onDone }) {
  const ref = useRef();
  const age = useRef(0);
  const rot = useRef(angle ?? Math.PI / 4 + (Math.random() - 0.5) * 0.6);

  useFrame((_, dt) => {
    age.current += dt;
    if (age.current > LIFE) { onDone?.(); return; }
    const t = age.current / LIFE;
    if (ref.current) {
      ref.current.scale.setScalar(0.6 + t * 1.2);
      ref.current.material.opacity = 1 - t;
    }
  });

  return (
    <mesh ref={ref} position={position} rotation={[0, 0, rot.current]}>
      <planeGeometry args={[0.5, 0.03]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={1} depthWrite={false} />
    </mesh>
  );
}
