import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { playShush } from '../audio/sounds.js';

// Voxel ninja built from primitive boxes (spec §5: no external asset).
// Timeline: walk in (facing travel direction) → stop, turn to camera →
// raise arm, "shush" hold → turn back → walk off → onDone().

// QA flags: ?ninjaSlow stretches the timeline; ?ninjaPose parks him mid-shush
const SLOW =
  typeof location !== 'undefined' && location.search.includes('ninjaSlow') ? 6 : 1;
const POSE = typeof location !== 'undefined' && location.search.includes('ninjaPose');

const PHASES = [
  { name: 'walkIn', dur: 2.2 * SLOW },
  { name: 'turn', dur: 0.4 * SLOW },
  { name: 'shush', dur: POSE ? 600 : 1.6 * SLOW },
  { name: 'turnBack', dur: 0.4 * SLOW },
  { name: 'walkOut', dur: 2.2 * SLOW },
];
const TOTAL = PHASES.reduce((s, p) => s + p.dur, 0);

function phaseAt(t) {
  let acc = 0;
  for (const p of PHASES) {
    if (t < acc + p.dur) return { ...p, local: (t - acc) / p.dur };
    acc += p.dur;
  }
  return { name: 'done', local: 1 };
}

export function Ninja({ onDone }) {
  const { viewport } = useThree();
  const group = useRef();
  const armR = useRef();
  const legL = useRef();
  const legR = useRef();
  const t = useRef(POSE ? PHASES[0].dur + PHASES[1].dur + 0.05 : 0);
  const shushPlayed = useRef(false);

  // Big enough to own the stage (the badges are pulled up while he's on).
  const scale = Math.min(2.2, viewport.height * 0.42);
  const xIn = -viewport.width / 2 - scale;
  const xMid = 0;
  const xOut = viewport.width / 2 + scale;
  // feet (leg bottoms) sit ~0.2 local units below the group origin
  const groundY = -viewport.height / 2 + 0.22 * scale + 0.15;

  useEffect(() => () => {}, []);

  useFrame((_, dt) => {
    // clamp frame hitches so a stalled tab pauses the show instead of skipping it
    t.current += Math.min(dt, 0.05);
    const ph = phaseAt(t.current);
    const g = group.current;
    if (!g) return;

    if (ph.name === 'done') { onDone?.(); return; }

    // position + facing per phase
    if (ph.name === 'walkIn') {
      g.position.x = xIn + (xMid - xIn) * ph.local;
      g.rotation.y = Math.PI / 2; // facing +x travel
    } else if (ph.name === 'turn') {
      g.position.x = xMid;
      g.rotation.y = Math.PI / 2 - (Math.PI / 2) * ph.local; // to face camera (0)
    } else if (ph.name === 'shush') {
      g.position.x = xMid;
      g.rotation.y = 0;
      if (!shushPlayed.current) { shushPlayed.current = true; playShush(); }
    } else if (ph.name === 'turnBack') {
      g.rotation.y = (Math.PI / 2) * ph.local;
    } else if (ph.name === 'walkOut') {
      g.position.x = xMid + (xOut - xMid) * ph.local;
      g.rotation.y = Math.PI / 2;
    }
    g.position.y = groundY;

    // walk cycle: leg swing + bob while moving
    const moving = ph.name === 'walkIn' || ph.name === 'walkOut';
    const swing = moving ? Math.sin(t.current * 10) * 0.5 : 0;
    if (legL.current) legL.current.rotation.x = swing;
    if (legR.current) legR.current.rotation.x = -swing;
    g.position.y += moving ? Math.abs(Math.sin(t.current * 10)) * 0.03 * scale : 0;

    // shush: raise right arm so "finger" voxel meets the mask
    if (armR.current) {
      const target = ph.name === 'shush' ? -2.4 : 0;
      armR.current.rotation.x += (target - armR.current.rotation.x) * Math.min(1, dt * 10);
    }
  });

  // charcoal with blue lift — pure near-black vanishes into the page bg
  const black = '#3d4358';
  const skin = '#e8b98f';

  return (
    <group ref={group} position={[xIn, groundY, 0.5]} scale={scale}>
      {/* personal stage light so he reads against the dark backdrop */}
      <pointLight position={[0.6, 1.6, 2.2]} intensity={14} distance={9} color="#fff4e0" />
      {/* torso */}
      <mesh position={[0, 0.55, 0]}>
        <boxGeometry args={[0.5, 0.6, 0.3]} />
        <meshStandardMaterial color={black} />
      </mesh>
      {/* head */}
      <mesh position={[0, 1.05, 0]}>
        <boxGeometry args={[0.42, 0.4, 0.4]} />
        <meshStandardMaterial color={black} />
      </mesh>
      {/* eye slit */}
      <mesh position={[0, 1.1, 0.21]}>
        <boxGeometry args={[0.34, 0.1, 0.02]} />
        <meshStandardMaterial color={skin} />
      </mesh>
      {/* headband tail */}
      <mesh position={[-0.24, 1.18, -0.15]} rotation={[0, 0, 0.5]}>
        <boxGeometry args={[0.25, 0.06, 0.04]} />
        <meshStandardMaterial color="#a33" />
      </mesh>
      {/* left arm */}
      <mesh position={[-0.34, 0.6, 0]}>
        <boxGeometry args={[0.14, 0.5, 0.14]} />
        <meshStandardMaterial color={black} />
      </mesh>
      {/* right arm — pivot at shoulder so it raises for the shush */}
      <group ref={armR} position={[0.34, 0.82, 0]}>
        <mesh position={[0, -0.22, 0]}>
          <boxGeometry args={[0.14, 0.5, 0.14]} />
          <meshStandardMaterial color={black} />
        </mesh>
        {/* finger voxel */}
        <mesh position={[0, -0.5, 0]}>
          <boxGeometry args={[0.07, 0.14, 0.07]} />
          <meshStandardMaterial color={skin} />
        </mesh>
      </group>
      {/* legs — pivot groups for walk swing */}
      <group ref={legL} position={[-0.13, 0.25, 0]}>
        <mesh position={[0, -0.22, 0]}>
          <boxGeometry args={[0.16, 0.45, 0.16]} />
          <meshStandardMaterial color={black} />
        </mesh>
      </group>
      <group ref={legR} position={[0.13, 0.25, 0]}>
        <mesh position={[0, -0.22, 0]}>
          <boxGeometry args={[0.16, 0.45, 0.16]} />
          <meshStandardMaterial color={black} />
        </mesh>
      </group>
    </group>
  );
}
