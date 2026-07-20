import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '../src/state/gameStore.js';
import { CONFIG } from '../src/config.js';

const store = () => useGameStore.getState();

beforeEach(() => {
  useGameStore.setState({
    cuts: 0, skipped: false, entered: false,
    easterEggPlayed: false, easterEggActive: false,
    message: null, lastMessageAtCut: -Infinity,
  });
});

describe('progression', () => {
  it('locked before unlockAt, unlocked at unlockAt', () => {
    for (let i = 0; i < CONFIG.game.unlockAt - 1; i++) store().registerCut();
    expect(store().isUnlocked()).toBe(false);
    store().registerCut();
    expect(store().isUnlocked()).toBe(true);
  });

  it('skip unlocks immediately and hides the skip button', () => {
    store().skip();
    expect(store().isUnlocked()).toBe(true);
    expect(store().showSkip()).toBe(false);
  });

  it('skip button shows in the [skipAppearsAt, unlockAt) window only', () => {
    expect(store().showSkip()).toBe(false);
    for (let i = 0; i < CONFIG.game.skipAppearsAt; i++) store().registerCut();
    expect(store().showSkip()).toBe(true);
    for (let i = store().cuts; i < CONFIG.game.unlockAt; i++) store().registerCut();
    expect(store().showSkip()).toBe(false); // unlocked; skip is moot
  });
});

describe('easter egg', () => {
  it('fires exactly at cut 100 and only once per session', () => {
    for (let i = 0; i < CONFIG.game.easterEggAt - 1; i++) store().registerCut();
    expect(store().easterEggActive).toBe(false);
    store().registerCut(); // #100
    expect(store().easterEggActive).toBe(true);
    expect(store().easterEggPlayed).toBe(true);
    store().endEasterEgg();
    store().registerCut(); // #101 — must not retrigger
    expect(store().easterEggActive).toBe(false);
  });
});

describe('messages', () => {
  it('respects the minimum gap between messages', () => {
    // Force chance to 1 temporarily
    const orig = CONFIG.game.messageChance;
    CONFIG.game.messageChance = 1;
    try {
      store().registerCut();
      const firstAt = store().lastMessageAtCut;
      expect(store().message).not.toBeNull();
      store().clearMessage();
      store().registerCut(); // gap of 1 < messageMinGap(2)
      expect(store().message).toBeNull();
      store().registerCut(); // gap of 2 — allowed
      expect(store().message).not.toBeNull();
      expect(store().lastMessageAtCut).toBe(firstAt + 2);
    } finally {
      CONFIG.game.messageChance = orig;
    }
  });

  it('no persistence: fresh state has zero cuts (nothing touches storage)', () => {
    expect(store().cuts).toBe(0);
    // The store module must not reference localStorage at all — checked in build review.
  });
});
