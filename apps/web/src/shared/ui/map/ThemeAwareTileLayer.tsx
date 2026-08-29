import { TileLayer } from 'react-leaflet';

import { useUserPreferences } from '@/shared/preferences';

import { getMapTileConfig } from './map-tiles';
import './map.css';

/**
 * Basemap raster CARTO según tema (Voyager / Dark Matter).
 * Nota: el color de labels (calles/ciudades) solo se puede customizar con
 * basemap vectorial; el intento MapLibre+Leaflet dejaba el mapa en negro.
 */
export function ThemeAwareTileLayer() {
  const { resolvedTheme } = useUserPreferences();
  const tiles = getMapTileConfig(resolvedTheme);

  return (
    <TileLayer
      key={resolvedTheme}
      attribution={tiles.attribution}
      url={tiles.url}
      maxZoom={20}
    />
  );
}
