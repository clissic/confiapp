import { useEffect, useMemo } from 'react';
import { Circle, MapContainer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import 'leaflet/dist/leaflet.css';

import { ThemeAwareTileLayer } from '@/shared/ui/map/ThemeAwareTileLayer';

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const coveragePinIcon = new L.Icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const MONTEVIDEO: [number, number] = [-34.9011, -56.1645];
const NOMINATIM_UA = 'ConfiApp/1.0 (agent-work-area; contact@confiapp.local)';

type NominatimResult = {
  lat: string;
  lon: string;
  display_name?: string;
  address?: {
    suburb?: string;
    neighbourhood?: string;
    quarter?: string;
    city_district?: string;
    city?: string;
    town?: string;
    village?: string;
  };
};

export async function geocodeCity(
  city: string,
  countryCode: string,
): Promise<{ lat: number; lng: number } | null> {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');
  url.searchParams.set('q', `${city}, ${countryCode}`);
  url.searchParams.set('countrycodes', countryCode.toLowerCase());
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': NOMINATIM_UA },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as NominatimResult[];
  const first = data[0];
  if (!first) return null;
  const lat = Number(first.lat);
  const lng = Number(first.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

export async function reverseGeocodeLabel(lat: number, lng: number): Promise<string | null> {
  const url = new URL('https://nominatim.openstreetmap.org/reverse');
  url.searchParams.set('format', 'json');
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lng));
  url.searchParams.set('zoom', '16');
  url.searchParams.set('addressdetails', '1');
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': NOMINATIM_UA },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as NominatimResult;
  const address = data.address;
  const short =
    address?.suburb ||
    address?.neighbourhood ||
    address?.quarter ||
    address?.city_district ||
    address?.city ||
    address?.town ||
    address?.village;
  if (short?.trim()) return short.trim().slice(0, 200);
  return data.display_name?.slice(0, 200) || null;
}

function MapLifecycle({
  center,
  zoom,
  focusKey,
}: {
  center: [number, number];
  zoom: number;
  focusKey: number;
}) {
  const map = useMap();

  useEffect(() => {
    const fixSize = () => {
      map.invalidateSize({ animate: false });
    };
    fixSize();
    const t1 = window.setTimeout(fixSize, 80);
    const t2 = window.setTimeout(fixSize, 320);
    window.addEventListener('resize', fixSize);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.removeEventListener('resize', fixSize);
    };
  }, [map]);

  useEffect(() => {
    map.invalidateSize({ animate: false });
    map.setView(center, zoom, { animate: true });
  }, [center, zoom, focusKey, map]);

  return null;
}

function MapClickHandler({
  canPick,
  onPick,
}: {
  canPick: boolean;
  onPick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(event) {
      if (!canPick) return;
      onPick(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

type Props = {
  canPick: boolean;
  lat: number | null;
  lng: number | null;
  radiusKm: number;
  focus: { lat: number; lng: number; zoom: number; key: number } | null;
  disabled?: boolean;
  onPick: (lat: number, lng: number) => void;
};

export function WorkAreaMapPicker({
  canPick,
  lat,
  lng,
  radiusKm,
  focus,
  disabled = false,
  onPick,
}: Props) {
  const pickEnabled = canPick && !disabled;
  const hasPin = lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng);

  const viewCenter = useMemo<[number, number]>(() => {
    if (hasPin) return [lat!, lng!];
    if (focus) return [focus.lat, focus.lng];
    return MONTEVIDEO;
  }, [hasPin, lat, lng, focus]);

  const viewZoom = focus?.zoom ?? (hasPin ? 13 : 11);
  /** Remount solo al habilitar selección; el foco se actualiza por MapLifecycle. */
  const mapKey = canPick ? 'work-area-ready' : 'work-area-wait';

  return (
    <div
      className={[
        'ca-work-area-map',
        pickEnabled ? 'ca-work-area-map--pick' : '',
        hasPin ? 'ca-work-area-map--pinned' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <MapContainer
        key={mapKey}
        center={viewCenter}
        zoom={viewZoom}
        scrollWheelZoom
        className="ca-work-area-map__canvas"
      >
        <MapLifecycle
          center={
            focus ? [focus.lat, focus.lng] : viewCenter
          }
          zoom={focus?.zoom ?? viewZoom}
          focusKey={focus?.key ?? 0}
        />
        <MapClickHandler
          canPick={pickEnabled}
          onPick={(nextLat, nextLng) => {
            onPick(Number(nextLat.toFixed(5)), Number(nextLng.toFixed(5)));
          }}
        />
        <ThemeAwareTileLayer />
        {hasPin ? (
          <>
            <Circle
              center={[lat!, lng!]}
              radius={Math.max(radiusKm, 0.5) * 1000}
              pathOptions={{
                color: '#55C5B5',
                fillColor: '#55C5B5',
                fillOpacity: 0.16,
                weight: 2,
              }}
            />
            <Marker
              position={[lat!, lng!]}
              icon={coveragePinIcon}
              draggable={pickEnabled}
              eventHandlers={{
                dragend: (event) => {
                  if (!pickEnabled) return;
                  const marker = event.target as L.Marker;
                  const { lat: nextLat, lng: nextLng } = marker.getLatLng();
                  onPick(Number(nextLat.toFixed(5)), Number(nextLng.toFixed(5)));
                },
              }}
            />
          </>
        ) : null}
      </MapContainer>
    </div>
  );
}
