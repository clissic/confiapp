const windows = new Map<string, { count: number; resetAt: number }>();

/**
 * Throttle in-memory por clave (userId+event). Suficiente para un proceso;
 * con Redis rate limits HTTP el abuso cross-réplica ya está cubierto en REST.
 */
export function allowSocketEvent(
  key: string,
  max: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  const current = windows.get(key);
  if (!current || current.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (current.count >= max) return false;
  current.count += 1;
  return true;
}
