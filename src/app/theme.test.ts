import { act, renderHook } from '@testing-library/react';
import { readPreference, resolveTheme, setPreference, startTheme, useTheme } from './theme';

function mockSystem(dark: boolean) {
  const listeners: (() => void)[] = [];
  const mql = {
    matches: dark,
    addEventListener: (_: string, l: () => void) => listeners.push(l),
  };
  vi.stubGlobal('matchMedia', () => mql);
  return {
    change(next: boolean) {
      mql.matches = next;
      for (const l of listeners) l();
    },
  };
}

afterEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove('dark');
  vi.unstubAllGlobals();
});

describe('theme', () => {
  it('defaults to system and follows the OS, live', () => {
    const os = mockSystem(false);
    startTheme();
    const { result } = renderHook(() => useTheme());
    expect(result.current).toEqual({ preference: 'system', resolved: 'light' });
    expect(document.documentElement).not.toHaveClass('dark');

    act(() => {
      os.change(true);
    });
    expect(result.current.resolved).toBe('dark');
    expect(document.documentElement).toHaveClass('dark');
  });

  it('remembers an explicit choice on this device, and goes back to system', () => {
    mockSystem(true);
    const { result } = renderHook(() => useTheme());
    act(() => {
      setPreference('light');
    });
    expect(result.current).toEqual({ preference: 'light', resolved: 'light' });
    expect(readPreference()).toBe('light');
    expect(document.documentElement).not.toHaveClass('dark');

    act(() => {
      setPreference('system');
    });
    expect(localStorage.getItem('trackworth.theme')).toBeNull();
    expect(result.current.resolved).toBe('dark');
  });

  it('ignores unknown stored values, and works without matchMedia', () => {
    localStorage.setItem('trackworth.theme', 'purple');
    expect(readPreference()).toBe('system');
    vi.stubGlobal('matchMedia', undefined);
    expect(resolveTheme()).toBe('light');
    startTheme();
    expect(resolveTheme('dark')).toBe('dark');
  });
});
