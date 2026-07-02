import '@testing-library/jest-dom/vitest';

// Mock AudioContext for sound utilities
class MockAudioContext {
  createOscillator() {
    return {
      type: 'sine',
      frequency: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
      connect: () => {},
      start: () => {},
      stop: () => {},
    };
  }
  createGain() {
    return {
      gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
      connect: () => {},
    };
  }
  get destination() {
    return {};
  }
  get currentTime() {
    return 0;
  }
}

globalThis.AudioContext = MockAudioContext as unknown as typeof AudioContext;

// Mock localStorage
const store: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { Object.keys(store).forEach(k => delete store[k]); },
  get length() { return Object.keys(store).length; },
  key: (i: number) => Object.keys(store)[i] ?? null,
};

// `configurable: true` lets individual tests swap the mock to simulate
// SecurityError-throwing storage (cross-origin iframes, locked-down browsers).
Object.defineProperty(globalThis, 'localStorage', { value: mockLocalStorage, configurable: true });
