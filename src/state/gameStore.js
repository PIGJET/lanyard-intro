// Session-only game state. Deliberately NO persistence (see spec §6):
// no localStorage, no cookies — a refresh resets everything.
import { create } from 'zustand';
import { CONFIG } from '../config.js';
import { pickMessage } from '../ui/messages.js';

export const useGameStore = create((set, get) => ({
  cuts: 0,
  skipped: false,
  entered: false,          // user clicked through to the portfolio
  easterEggPlayed: false,
  easterEggActive: false,
  message: null,           // { id, text } current encouragement toast
  lastMessageAtCut: -Infinity,

  registerCut: () => {
    const s = get();
    const cuts = s.cuts + 1;
    const patch = { cuts };

    // Encouragement messages: random cadence with a minimum gap, through cut 100.
    if (
      cuts <= CONFIG.game.easterEggAt &&
      cuts - s.lastMessageAtCut >= CONFIG.game.messageMinGap &&
      Math.random() < CONFIG.game.messageChance
    ) {
      patch.message = { id: cuts, text: pickMessage(cuts) };
      patch.lastMessageAtCut = cuts;
    }

    if (cuts === CONFIG.game.easterEggAt && !s.easterEggPlayed) {
      patch.easterEggActive = true;
      patch.easterEggPlayed = true; // once per session
    }

    set(patch);
  },

  clearMessage: () => set({ message: null }),
  skip: () => set({ skipped: true }),
  enterPortfolio: () => set({ entered: true }),
  backToIntro: () => set({ entered: false }), // footer link; cuts survive (session state)
  endEasterEgg: () => set({ easterEggActive: false }),

  // Derived helpers
  isUnlocked: () => {
    const s = get();
    return s.skipped || s.cuts >= CONFIG.game.unlockAt;
  },
  showSkip: () => {
    const s = get();
    return !s.skipped && s.cuts >= CONFIG.game.skipAppearsAt && s.cuts < CONFIG.game.unlockAt;
  },
}));

// Console handle for manual testing (e.g. jump to the 100-cut easter egg with
// __gameStore.setState({ cuts: 99 }) and one real cut). Session-only state.
if (typeof window !== 'undefined') window.__gameStore = useGameStore;
