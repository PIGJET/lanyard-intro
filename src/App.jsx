import { lazy, Suspense } from 'react';
import { useGameStore } from './state/gameStore.js';
import { Hud } from './ui/Hud.jsx';

// Three + Rapier (~3 MB pre-gzip) load as separate chunks; the HUD shell and
// background paint immediately while the 3D scene streams in.
const Scene = lazy(() => import('./scene/Scene.jsx').then((m) => ({ default: m.Scene })));
const Portfolio = lazy(() =>
  import('./portfolio/Portfolio.jsx').then((m) => ({ default: m.Portfolio }))
);

function SceneLoader() {
  return (
    <div className="scene-loader" role="status" aria-label="Loading">
      <span className="scene-loader-dot" />
      sharpening scissors
    </div>
  );
}

export default function App() {
  const entered = useGameStore((s) => s.entered);
  if (entered) {
    return (
      <Suspense fallback={<SceneLoader />}>
        <Portfolio />
      </Suspense>
    );
  }
  return (
    <>
      <Suspense fallback={<SceneLoader />}>
        <Scene />
      </Suspense>
      <Hud />
    </>
  );
}
