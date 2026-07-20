import { useCallback, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import { Environment, Lightformer } from '@react-three/drei';
import { CONFIG } from '../config.js';
import { useGameStore } from '../state/gameStore.js';
import { playCut } from '../audio/sounds.js';
import { BadgeRig } from './BadgeRig.jsx';
import { CutDetector } from './CutDetector.jsx';
import { ParticleBurst } from './effects/ParticleBurst.jsx';
import { SliceMark } from './effects/SliceMark.jsx';
import { Ninja } from './Ninja.jsx';

let effectId = 0;

function World() {
  const ropesRef = useRef(new Map());
  const [effects, setEffects] = useState([]);
  const registerCut = useGameStore((s) => s.registerCut);
  const easterEggActive = useGameStore((s) => s.easterEggActive);
  const endEasterEgg = useGameStore((s) => s.endEasterEgg);

  const registerRope = useCallback((slot, rope, onCut) => {
    ropesRef.current.set(slot, { rope, onCut });
    return () => ropesRef.current.delete(slot);
  }, []);

  const removeEffect = useCallback((id) => {
    setEffects((fx) => fx.filter((f) => f.id !== id));
  }, []);

  const handleCut = useCallback(
    (worldPoint, swipeAngle) => {
      registerCut();
      playCut();
      const id = ++effectId;
      setEffects((fx) => [
        ...fx,
        { id, kind: 'burst', position: worldPoint },
        { id: id + 100000, kind: 'slice', position: worldPoint, angle: swipeAngle },
      ]);
    },
    [registerCut]
  );

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[3, 5, 4]} intensity={1.1} />
      <directionalLight position={[-4, 2, 2]} intensity={0.35} color="#9db4ff" />

      {/* Local light-panel environment (no HDRI fetch — artifact CSP blocks
          external hosts). The angled panels paint the diagonal streaks that
          sell the glossy laminate as it swings. */}
      <Environment resolution={256}>
        <Lightformer intensity={2.2} position={[0, 4, 6]} rotation={[-0.3, 0, 0]} scale={[10, 3, 1]} />
        <Lightformer intensity={1.4} position={[-6, 2, 2]} rotation={[0, Math.PI / 3, 0.4]} scale={[8, 1.6, 1]} />
        <Lightformer intensity={1.2} position={[6, 0, 2]} rotation={[0, -Math.PI / 3, -0.4]} scale={[8, 1.6, 1]} />
        <Lightformer intensity={0.7} color="#9db4ff" position={[0, -5, 4]} scale={[10, 2, 1]} />
      </Environment>

      <Physics gravity={[0, -9.8, 0]}>
        <BadgeRig slot={0} registerRope={registerRope} onCut={handleCut} />
        <BadgeRig slot={1} registerRope={registerRope} onCut={handleCut} />
      </Physics>

      <CutDetector ropesRef={ropesRef} />

      {effects.map((f) =>
        f.kind === 'burst' ? (
          <ParticleBurst key={f.id} position={f.position} onDone={() => removeEffect(f.id)} />
        ) : (
          <SliceMark key={f.id} position={f.position} angle={f.angle} onDone={() => removeEffect(f.id)} />
        )
      )}

      {easterEggActive && <Ninja onDone={endEasterEgg} />}
    </>
  );
}

export function Scene() {
  return (
    <Canvas
      camera={{ position: [0, 0, CONFIG.camera.z], fov: CONFIG.camera.fov }}
      gl={{ alpha: true, antialias: true }}
      style={{ position: 'fixed', inset: 0, touchAction: 'none' }}
      dpr={[1, 2]}
    >
      <World />
    </Canvas>
  );
}
