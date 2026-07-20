// The actual portfolio: brutalist gray layout over a fixed ASL-hand canvas.
// Scrolling drives the hand through L → O → V → E (one letter per section).
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useGameStore } from '../state/gameStore.js';
import { CONTENT } from './content.js';
import { LETTERS, letterProgress } from './handPoses.js';
import './portfolio.css';

const HandScene = lazy(() =>
  import('./HandScene.jsx').then((m) => ({ default: m.HandScene }))
);

/** Live local clock, styled like the reference site's "SPB,RU_08:05:04". */
function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const pad = (n) => String(n).padStart(2, '0');
  return (
    <span>
      {CONTENT.location}_{pad(now.getHours())}:{pad(now.getMinutes())}:{pad(now.getSeconds())}
    </span>
  );
}

/** Infinite sliding window of stack items (track duplicated for a seamless loop). */
function Marquee({ items, reverse = false }) {
  const track = [...items, ...items];
  return (
    <div className="pf-marquee">
      <div
        className={`pf-marquee-track${reverse ? ' rev' : ''}`}
        style={{ animationDuration: `${items.length * 3.2}s` }}
      >
        {track.map((item, i) => (
          <span className="pf-mq-item" key={i} aria-hidden={i >= items.length}>
            {item}
            <span className="pf-mq-star">✳</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function Portfolio() {
  const cuts = useGameStore((s) => s.cuts);
  const backToIntro = useGameStore((s) => s.backToIntro);
  const rootRef = useRef(null);
  const [activeLetter, setActiveLetter] = useState(0);
  // Mutated directly (not state) — the canvas reads it every frame.
  const motionRef = useRef({ letterFloat: 0, px: 0, py: 0, reduced: false });

  useEffect(() => {
    const root = rootRef.current;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    let centers = [];

    const measure = () => {
      centers = [...root.querySelectorAll('[data-letter]')].map(
        (el) => el.offsetTop + el.offsetHeight / 2
      );
    };

    const onScroll = () => {
      const center = root.scrollTop + root.clientHeight / 2;
      const lf = letterProgress(centers, center);
      motionRef.current.letterFloat = lf;
      motionRef.current.reduced = mq.matches;
      const active = Math.round(lf);
      setActiveLetter((prev) => (prev === active ? prev : active));
    };

    const onPointer = (e) => {
      motionRef.current.px = (e.clientX / window.innerWidth) * 2 - 1;
      motionRef.current.py = (e.clientY / window.innerHeight) * 2 - 1;
    };

    measure();
    onScroll();
    root.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', measure);
    window.addEventListener('pointermove', onPointer, { passive: true });
    return () => {
      root.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', measure);
      window.removeEventListener('pointermove', onPointer);
    };
  }, []);

  return (
    <div className="portfolio" ref={rootRef}>
      <Suspense fallback={null}>
        <HandScene motionRef={motionRef} />
      </Suspense>

      {/* fixed chrome */}
      <header className="pf-meta">
        <a href={`mailto:${CONTENT.email}`}>{CONTENT.email.toUpperCase()}</a>
        <Clock />
        <span className="pf-meta-mark">{CONTENT.displayName}</span>
      </header>

      <aside className="pf-letters" aria-label="ASL fingerspelling progress">
        {LETTERS.map((l, i) => (
          <span key={l} className={`pf-letter${i === activeLetter ? ' on' : ''}${i < activeLetter ? ' done' : ''}`}>
            {l}
          </span>
        ))}
        <span className="pf-letters-note">FINGERSPELLED IN ASL</span>
      </aside>

      {/* L — hero */}
      <section className="pf-section pf-hero" data-letter>
        <div className="pf-tag">[ CUTS MADE ] {cuts}'_</div>
        <h1 className="pf-display">{CONTENT.displayName}</h1>
        <p className="pf-role">{CONTENT.role}</p>
        <p className="pf-tagline">{CONTENT.tagline}</p>
        <div className="pf-scrollhint">SCROLL — THE HAND SPELLS AS YOU GO ↓</div>
      </section>

      {/* O — about */}
      <section className="pf-section pf-about" data-letter>
        <h2 className="pf-h2">[ ABOUT ]</h2>
        <div className="pf-about-copy">
          {CONTENT.about.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      </section>

      {/* V — projects */}
      <section className="pf-section pf-projects" data-letter>
        <h2 className="pf-h2">[ SELECTED WORKS ]</h2>
        <ul className="pf-worklist">
          {CONTENT.projects.map((pr) => (
            <li className="pf-work" key={pr.index}>
              <span className="pf-work-idx">{pr.index}</span>
              <span className="pf-work-title">{pr.title}</span>
              <span className="pf-work-tags">{pr.tags}</span>
              <span className="pf-work-year">{pr.year}</span>
              <span className="pf-work-desc">{pr.desc}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* E — stack + footer */}
      <section className="pf-section pf-stack" data-letter>
        <h2 className="pf-h2">[ TECHNICAL STACK ]</h2>
        <Marquee items={CONTENT.stack.rowA} />
        <Marquee items={CONTENT.stack.rowB} reverse />

        <footer className="pf-footer">
          <div className="pf-love" aria-label="LOVE, fingerspelled">
            {LETTERS.map((l) => (
              <span key={l}>{l}</span>
            ))}
          </div>
          <a className="pf-footer-mail" href={`mailto:${CONTENT.email}`}>
            {CONTENT.email.toUpperCase()}
          </a>
          <nav className="pf-socials">
            {CONTENT.socials.map((s) => (
              <a key={s.label} href={s.href} target="_blank" rel="noreferrer">
                {s.label} ↗
              </a>
            ))}
            <button className="pf-back" onClick={backToIntro}>
              ← BACK TO THE LANYARDS
            </button>
          </nav>
          <div className="pf-fine">© 2026 — HAND-SPELLED WITH ✳ IN ASL</div>
        </footer>
      </section>
    </div>
  );
}
