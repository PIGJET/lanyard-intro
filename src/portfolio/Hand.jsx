// Procedural cartoon glove (Mickey-style, like the reference site) built from
// capsules + rounded boxes. All joint targets come from pure handPoses.js; this
// component only damps current rotations toward them each frame.
import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import { MathUtils } from 'three';
import { poseAtLetter } from './handPoses.js';

// Max curl per joint (radians) — a curl of 1 folds the finger to the palm.
const MCP = 1.35;
const PIP = 1.6;
const DIP = 0.95;

// x across the palm, phalanx lengths base→tip, capsule radius.
const FINGERS = [
  { x: -0.58, lens: [0.5, 0.4, 0.3], r: 0.2 },   // index
  { x: -0.2, lens: [0.56, 0.45, 0.33], r: 0.21 }, // middle
  { x: 0.18, lens: [0.51, 0.41, 0.3], r: 0.2 },   // ring
  { x: 0.55, lens: [0.38, 0.3, 0.23], r: 0.17 },  // pinky
];
const PALM_TOP = 0.68;

function Phalanx({ len, r }) {
  return (
    <mesh position={[0, len / 2, 0]}>
      <capsuleGeometry args={[r, len, 6, 14]} />
      <meshStandardMaterial color="#dedeD8" roughness={0.55} />
    </mesh>
  );
}

function Finger({ cfg, joints }) {
  const { lens, r } = cfg;
  return (
    <group ref={(g) => (joints.mcp = g)} position={[cfg.x, PALM_TOP, 0]}>
      <Phalanx len={lens[0]} r={r} />
      <group ref={(g) => (joints.pip = g)} position={[0, lens[0], 0]}>
        <Phalanx len={lens[1]} r={r * 0.94} />
        <group ref={(g) => (joints.dip = g)} position={[0, lens[1], 0]}>
          <Phalanx len={lens[2]} r={r * 0.88} />
        </group>
      </group>
    </group>
  );
}

export function Hand({ motionRef }) {
  const root = useRef();
  const wrist = useRef();
  const fingerJoints = useMemo(() => FINGERS.map(() => ({})), []);
  const thumb = useRef({});
  const viewport = useThree((s) => s.viewport);

  useFrame((state, dt) => {
    const m = motionRef.current;
    const pose = poseAtLetter(m.letterFloat);
    const L = 8; // damp lambda — snappy but smooth
    const d = (cur, target) => MathUtils.damp(cur, target, L, dt);

    fingerJoints.forEach((j, i) => {
      const { curl, spread } = pose.fingers[i];
      if (!j.mcp) return;
      j.mcp.rotation.x = d(j.mcp.rotation.x, curl * MCP);
      j.mcp.rotation.z = d(j.mcp.rotation.z, spread);
      j.pip.rotation.x = d(j.pip.rotation.x, curl * PIP);
      j.dip.rotation.x = d(j.dip.rotation.x, curl * DIP);
    });

    const t = thumb.current;
    if (t.root) {
      const { curl, out } = pose.thumb;
      t.root.rotation.z = d(t.root.rotation.z, -(0.45 + out * 0.9));
      t.root.rotation.x = d(t.root.rotation.x, curl * 0.55);
      t.root.rotation.y = d(t.root.rotation.y, curl * 0.9);
      t.mid.rotation.x = d(t.mid.rotation.x, curl * 1.25);
    }

    if (wrist.current) {
      wrist.current.rotation.z = d(wrist.current.rotation.z, pose.wrist.roll);
      wrist.current.rotation.x = d(wrist.current.rotation.x, pose.wrist.pitch);
    }

    if (root.current) {
      const idle = m.reduced ? 0 : Math.sin(state.clock.elapsedTime * 0.8) * 0.04;
      const px = m.reduced ? 0 : m.px;
      const py = m.reduced ? 0 : m.py;
      root.current.rotation.y = d(root.current.rotation.y, px * 0.45);
      root.current.rotation.x = d(root.current.rotation.x, py * 0.22 + idle);
      // Right of centre on wide screens, centred on narrow ones; fit height.
      root.current.position.x = d(root.current.position.x, Math.min(viewport.width * 0.18, 1.15));
      const s = Math.min(1, viewport.height / 4.8, viewport.width / 4.2);
      root.current.scale.setScalar(s);
    }
  });

  return (
    <group ref={root} position={[0, -0.35, 0]}>
      <group ref={wrist}>
        {/* palm */}
        <RoundedBox args={[1.62, 1.5, 0.62]} radius={0.26} smoothness={5}>
          <meshStandardMaterial color="#dedeD8" roughness={0.55} />
        </RoundedBox>
        {/* glove cuff */}
        <mesh position={[0, -0.95, 0]}>
          <cylinderGeometry args={[0.52, 0.58, 0.5, 24]} />
          <meshStandardMaterial color="#d3d3cc" roughness={0.65} />
        </mesh>
        <mesh position={[0, -0.72, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.56, 0.09, 12, 32]} />
          <meshStandardMaterial color="#c33d26" roughness={0.5} />
        </mesh>

        {FINGERS.map((cfg, i) => (
          <Finger key={i} cfg={cfg} joints={fingerJoints[i]} />
        ))}

        {/* thumb: two segments off the palm's side */}
        <group ref={(g) => (thumb.current.root = g)} position={[0.78, 0.05, 0.12]}>
          <Phalanx len={0.48} r={0.23} />
          <group ref={(g) => (thumb.current.mid = g)} position={[0, 0.48, 0]}>
            <Phalanx len={0.4} r={0.21} />
          </group>
        </group>
      </group>
    </group>
  );
}
