import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../state/gameStore.js';
import { CONFIG } from '../config.js';

/** Counter that pops on increment. */
function Counter({ cuts }) {
  const [pop, setPop] = useState(false);
  const prev = useRef(cuts);
  useEffect(() => {
    if (cuts !== prev.current) {
      prev.current = cuts;
      setPop(true);
      const t = setTimeout(() => setPop(false), 220);
      return () => clearTimeout(t);
    }
  }, [cuts]);
  return (
    <div className={`hud-counter ${pop ? 'pop' : ''}`} aria-live="polite">
      <span className="hud-counter-num">{cuts}</span>
      <span className="hud-counter-label">{cuts === 1 ? 'cut' : 'cuts'}</span>
    </div>
  );
}

/** Encouragement toast; auto-clears. */
function MessageToast() {
  const message = useGameStore((s) => s.message);
  const clearMessage = useGameStore((s) => s.clearMessage);
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(clearMessage, 1600);
    return () => clearTimeout(t);
  }, [message, clearMessage]);
  if (!message) return null;
  return (
    <div key={message.id} className="hud-toast" role="status">
      {message.text}
    </div>
  );
}

export function Hud() {
  const cuts = useGameStore((s) => s.cuts);
  const skipped = useGameStore((s) => s.skipped);
  const skip = useGameStore((s) => s.skip);
  const enterPortfolio = useGameStore((s) => s.enterPortfolio);
  const easterEggActive = useGameStore((s) => s.easterEggActive);

  const unlocked = skipped || cuts >= CONFIG.game.unlockAt;
  const showSkip = !unlocked && cuts >= CONFIG.game.skipAppearsAt;

  // While the ninja is on stage, clear everything but the counter so nothing
  // covers him (the Enter button used to block the shush).
  if (easterEggActive) {
    return (
      <div className="hud">
        <Counter cuts={cuts} />
      </div>
    );
  }

  return (
    <div className="hud">
      <Counter cuts={cuts} />
      <MessageToast />

      {cuts === 0 && (
        <div className="hud-hint">slice across a lanyard to cut it</div>
      )}

      {showSkip && (
        <button className="hud-skip" onClick={skip}>
          skip →
        </button>
      )}

      {unlocked && (
        <div className="hud-cta">
          <button className="hud-enter" onClick={enterPortfolio}>
            Enter portfolio
          </button>
          <div className="hud-cta-sub">or keep cutting — no judgment</div>
        </div>
      )}
    </div>
  );
}
