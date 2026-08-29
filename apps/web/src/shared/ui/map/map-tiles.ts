import type { ResolvedTheme } from '@/shared/preferences';
import { env } from '@/shared/config/env';

export interface MapTileConfig {
  url: string;
  attribution: string;
}

export const MAP_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

function withCartoKey(baseUrl: string): string {
  const key = env.cartoApiKey;
  if (!key) return baseUrl;
  const sep = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${sep}key=${encodeURIComponent(key)}`;
}

/**
 * Capas raster CARTO alineadas al tema (light / dark).
 * @see https://carto.com/basemaps/apikey
 */
export function getMapTileConfig(theme: ResolvedTheme): MapTileConfig {
  if (theme === 'dark') {
    return {
      url: withCartoKey('https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'),
      attribution: MAP_ATTRIBUTION,
    };
  }
  return {
    url: withCartoKey(
      'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
    ),
    attribution: MAP_ATTRIBUTION,
  };
}
