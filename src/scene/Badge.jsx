import { useMemo } from 'react';
import * as THREE from 'three';
import { RoundedBox } from '@react-three/drei';
import { CONFIG } from '../config.js';

// ── Placeholder content (spec §9: structured for later swap) ─────────────
// To use real content later: pass { name, title, photoUrl } via the `content`
// prop; if photoUrl is set we load it as a texture instead of drawing initials.
export const PLACEHOLDER_BADGES = [
  { name: 'Your Name', title: 'Creative Developer', accent: '#4f8cff' },
  { name: 'Your Name', title: 'Portfolio · 2026', accent: '#ff6b6b' },
];

/** Draws the badge face (photo box, name, title) into a canvas texture. */
function makeFaceTexture({ name, title, accent }) {
  const W = 512;
  const H = Math.round(W * (CONFIG.badge.height / CONFIG.badge.width));
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');

  // card body
  g.fillStyle = '#f5f4f0';
  g.fillRect(0, 0, W, H);
  // top color band + clip slot
  g.fillStyle = accent;
  g.fillRect(0, 0, W, 96);
  g.fillStyle = '#c9c7c2';
  g.beginPath();
  g.roundRect(W / 2 - 60, 34, 120, 26, 13);
  g.fill();

  // placeholder headshot: grey box with silhouette-ish circle
  const pw = 260;
  const px = (W - pw) / 2;
  const py = 150;
  g.fillStyle = '#dddbd6';
  g.beginPath();
  g.roundRect(px, py, pw, pw, 18);
  g.fill();
  g.fillStyle = '#b8b5af';
  g.beginPath();
  g.arc(W / 2, py + pw * 0.38, pw * 0.2, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.arc(W / 2, py + pw * 1.02, pw * 0.42, Math.PI, 0, true);
  g.fill();

  // name + title
  g.fillStyle = '#22211f';
  g.font = '700 52px system-ui, sans-serif';
  g.textAlign = 'center';
  g.fillText(name, W / 2, py + pw + 88);
  g.fillStyle = '#77746e';
  g.font = '400 34px system-ui, sans-serif';
  g.fillText(title, W / 2, py + pw + 138);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/**
 * Visual mesh for a badge (physics body lives in BadgeRig).
 * Two layers: printed card base + glossy laminate shell slightly larger,
 * using clearcoat + low transmission so it reads as laminated plastic.
 */
export function Badge({ content = PLACEHOLDER_BADGES[0] }) {
  const { width, height, depth, cornerRadius } = CONFIG.badge;
  const faceTex = useMemo(() => makeFaceTexture(content), [content]);

  return (
    <group>
      {/* base card body — metallic-glossy so the environment streaks across it */}
      <RoundedBox args={[width, height, depth]} radius={cornerRadius} smoothness={3}>
        <meshPhysicalMaterial
          color="#f5f4f0"
          roughness={0.38}
          metalness={0.6}
          clearcoat={1}
          clearcoatRoughness={0.18}
          envMapIntensity={1.1}
        />
      </RoundedBox>
      {/* printed face */}
      <mesh position={[0, 0, depth / 2 + 0.001]}>
        <planeGeometry args={[width * 0.96, height * 0.96]} />
        <meshPhysicalMaterial
          map={faceTex}
          roughness={0.42}
          metalness={0.25}
          clearcoat={0.8}
          clearcoatRoughness={0.25}
          envMapIntensity={0.9}
        />
      </mesh>
      {/* laminate shell: clearcoat gloss + faint fresnel via sheen */}
      <RoundedBox args={[width * 1.015, height * 1.015, depth * 1.5]} radius={cornerRadius} smoothness={3}>
        <meshPhysicalMaterial
          transparent
          opacity={0.16}
          roughness={0.18}
          metalness={0}
          clearcoat={1}
          clearcoatRoughness={0.12}
          sheen={0.6}
          sheenRoughness={0.4}
          sheenColor="#ffffff"
          color="#ffffff"
          depthWrite={false}
        />
      </RoundedBox>
    </group>
  );
}
