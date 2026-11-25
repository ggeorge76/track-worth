import '@testing-library/jest-dom/vitest';

// jsdom has no layout engine or ResizeObserver; Recharts' ResponsiveContainer needs it to exist.
class NoopResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
if (!('ResizeObserver' in globalThis))
  Object.assign(globalThis, { ResizeObserver: NoopResizeObserver });

// Tests never reach the network: code that would fetch (e.g. exchange rates) gets a failure, the
// same as being offline. Tests that need responses inject their own fetch.
globalThis.fetch = () => Promise.reject(new TypeError('No network in tests'));
