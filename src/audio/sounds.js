// Placeholder audio, structured for later swap (spec §7, §9).
// Replace PLACEHOLDER_URLS values with real file URLs and everything else stays put.
// Until real files exist, we synthesize a tiny "snip" with WebAudio so the
// trigger points work without shipping binary assets.

const PLACEHOLDER_URLS = {
  cut: null,    // e.g. '/audio/snip.mp3'
  shush: null,  // e.g. '/audio/shush.mp3'
};

let ctx = null;
const buffers = {};

function ensureCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

async function load(name) {
  const url = PLACEHOLDER_URLS[name];
  if (!url || buffers[name]) return;
  const res = await fetch(url);
  buffers[name] = await ensureCtx().decodeAudioData(await res.arrayBuffer());
}

/** Synth fallback: short filtered noise burst reads as a "snip". */
function synthSnip(ac) {
  const dur = 0.09;
  const buf = ac.createBuffer(1, ac.sampleRate * dur, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 2;
  const src = ac.createBufferSource();
  src.buffer = buf;
  const hp = ac.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 2200;
  const gain = ac.createGain();
  gain.gain.value = 0.35;
  src.connect(hp).connect(gain).connect(ac.destination);
  src.start();
}

export function playCut() {
  try {
    const ac = ensureCtx();
    if (buffers.cut) {
      const src = ac.createBufferSource();
      src.buffer = buffers.cut;
      src.playbackRate.value = 0.95 + Math.random() * 0.1; // subtle variation
      src.connect(ac.destination);
      src.start();
    } else {
      synthSnip(ac);
      load('cut'); // opportunistic lazy-load if a URL gets configured
    }
  } catch { /* audio is non-critical */ }
}

export function playShush() {
  try {
    const ac = ensureCtx();
    if (buffers.shush) {
      const src = ac.createBufferSource();
      src.buffer = buffers.shush;
      src.connect(ac.destination);
      src.start();
    } else {
      // soft descending noise as placeholder "shhh"
      const dur = 0.6;
      const buf = ac.createBuffer(1, ac.sampleRate * dur, ac.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.5 * (1 - i / d.length);
      const src = ac.createBufferSource();
      src.buffer = buf;
      const lp = ac.createBiquadFilter();
      lp.type = 'bandpass';
      lp.frequency.value = 3000;
      const gain = ac.createGain();
      gain.gain.value = 0.25;
      src.connect(lp).connect(gain).connect(ac.destination);
      src.start();
      load('shush');
    }
  } catch { /* non-critical */ }
}
