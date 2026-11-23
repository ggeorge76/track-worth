import '@testing-library/jest-dom/vitest';

// jsdom has no layout engine or ResizeObserver; Recharts' ResponsiveContainer needs it to exist.
class NoopResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
if (!('ResizeObserver' in globalThis))
  Object.assign(globalThis, { ResizeObserver: NoopResizeObserver });
