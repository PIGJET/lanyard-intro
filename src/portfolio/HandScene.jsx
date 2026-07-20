// Fixed full-viewport canvas behind the portfolio content. Reads scroll/cursor
// targets from motionRef (mutated by Portfolio.jsx) — no react re-renders.
import { Canvas } from '@react-three/fiber';
import { Hand } from './Hand.jsx';

export function HandScene({ motionRef }) {
  return (
    <div className="pf-hand-layer" aria-hidden="true">
      <Canvas
        camera={{ fov: 40, position: [0, 0, 6] }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.85} />
        <directionalLight position={[3, 5, 6]} intensity={1.15} />
        <directionalLight position={[-4, 2, -3]} intensity={0.35} />
        <Hand motionRef={motionRef} />
      </Canvas>
    </div>
  );
}
