import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { VITE_PRELOAD_RELOAD_KEY, handleVitePreloadError } from './vite-preload-recovery';

describe('handleVitePreloadError', () => {
  const reload = vi.fn();

  beforeEach(() => {
    sessionStorage.clear();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, reload },
    });
    reload.mockClear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('recarga una sola vez', () => {
    const first = { preventDefault: vi.fn() } as unknown as Event;
    handleVitePreloadError(first);
    expect(first.preventDefault).toHaveBeenCalledOnce();
    expect(sessionStorage.getItem(VITE_PRELOAD_RELOAD_KEY)).toBe('1');
    expect(reload).toHaveBeenCalledOnce();

    const second = { preventDefault: vi.fn() } as unknown as Event;
    handleVitePreloadError(second);
    expect(second.preventDefault).toHaveBeenCalledOnce();
    expect(reload).toHaveBeenCalledOnce();
  });
});
