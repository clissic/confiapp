/** Evita un bucle de recarga si el chunk sigue faltando después del primer refresh. */
export const VITE_PRELOAD_RELOAD_KEY = 'confiapp:vite-preload-reload';

/**
 * Recarga una sola vez cuando Vite no puede precargar un chunk viejo
 * (típico después de un deploy que cambió los hashes).
 */
export function handleVitePreloadError(event: Event): void {
  event.preventDefault();
  try {
    if (sessionStorage.getItem(VITE_PRELOAD_RELOAD_KEY) === '1') {
      return;
    }
    sessionStorage.setItem(VITE_PRELOAD_RELOAD_KEY, '1');
  } catch {
    // sessionStorage puede no estar disponible; no recargamos para no entrar en un bucle.
    return;
  }
  window.location.reload();
}

export function registerVitePreloadRecovery(): void {
  window.addEventListener('vite:preloadError', handleVitePreloadError);
}
