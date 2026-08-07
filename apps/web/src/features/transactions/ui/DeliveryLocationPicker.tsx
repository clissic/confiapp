import { useEffect, useState } from 'react';
import { Alert, Button, Form, Spinner } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Search } from 'lucide-react';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import 'leaflet/dist/leaflet.css';

import type { ProfileAddress, UserProfile } from '@/features/profile/model/types';

import type { DeliveryLocationValue, MeetingLocationMode } from '../model/types';

// Vite rompe las rutas relativas del ícono por defecto de Leaflet.
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const deliveryPinIcon = new L.Icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const MONTEVIDEO: [number, number] = [-34.9011, -56.1645];
const NOMINATIM_UA = 'ConfiApp/1.0 (delivery-location; contact@confiapp.local)';

export function hasRegisteredAddress(
  profile: Pick<UserProfile, 'address'> | null | undefined,
): boolean {
  const address = profile?.address;
  return Boolean(
    address?.line1?.trim() && address?.city?.trim() && address?.country?.trim(),
  );
}

export function formatRegisteredAddress(address: ProfileAddress): string {
  return [address.line1, address.line2, address.city, address.state, address.country]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(', ');
}

type NominatimResult = {
  lat: string;
  lon: string;
  display_name?: string;
};

async function geocodeForward(query: string): Promise<{
  lat: number;
  lng: number;
  label: string;
} | null> {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');
  url.searchParams.set('q', query);
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
  return {
    lat,
    lng,
    label: (first.display_name || query).slice(0, 200),
  };
}

async function geocodeReverse(lat: number, lng: number): Promise<string | null> {
  const url = new URL('https://nominatim.openstreetmap.org/reverse');
  url.searchParams.set('format', 'json');
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lng));
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': NOMINATIM_UA },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { display_name?: string };
  return data.display_name?.slice(0, 200) || null;
}

function MapViewController({
  focus,
}: {
  focus: { lat: number; lng: number; zoom: number; key: number } | null;
}) {
  const map = useMap();
  useEffect(() => {
    if (!focus) return;
    map.setView([focus.lat, focus.lng], focus.zoom);
  }, [focus, map]);
  return null;
}

function MapClickHandler({
  enabled,
  onPick,
}: {
  enabled: boolean;
  onPick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(event) {
      if (!enabled) return;
      onPick(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}
type Props = {
  value: DeliveryLocationValue;
  onChange: (next: DeliveryLocationValue) => void;
  profile?: UserProfile | null;
  disabled?: boolean;
};

export function DeliveryLocationPicker({
  value,
  onChange,
  profile,
  disabled = false,
}: Props) {
  const hasHome = hasRegisteredAddress(profile);
  const homeLabel = profile?.address ? formatRegisteredAddress(profile.address) : '';

  const [addressQuery, setAddressQuery] = useState(value.meetingLocation?.label ?? '');
  const [geoBusy, setGeoBusy] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [mapFocus, setMapFocus] = useState<{
    lat: number;
    lng: number;
    zoom: number;
    key: number;
  } | null>(null);

  const mode = value.mode;
  const coords = value.meetingLocation?.coordinates;
  const markerLat = coords?.[1] ?? MONTEVIDEO[0];
  const markerLng = coords?.[0] ?? MONTEVIDEO[1];
  const mapEnabled = mode === 'MAP' && !disabled;

  const focusMapOn = (lat: number, lng: number, zoom = 15) => {
    setMapFocus((prev) => ({
      lat,
      lng,
      zoom,
      key: (prev?.key ?? 0) + 1,
    }));
  };

  const emit = (
    nextMode: MeetingLocationMode,
    meetingLocation?: DeliveryLocationValue['meetingLocation'],
  ) => {
    onChange({
      mode: nextMode,
      meetingLocation: nextMode === 'CHAT' ? undefined : meetingLocation,
    });
  };

  const setPoint = async (
    lat: number,
    lng: number,
    options?: { labelHint?: string; recenter?: boolean },
  ) => {
    setGeoBusy(true);
    setGeoError(null);
    try {
      const label =
        options?.labelHint?.trim() ||
        (await geocodeReverse(lat, lng)) ||
        `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      setAddressQuery(label);
      emit(mode === 'HOME' ? 'HOME' : 'MAP', {
        type: 'Point',
        coordinates: [lng, lat],
        label: label.slice(0, 200),
      });
      if (options?.recenter) {
        focusMapOn(lat, lng);
      }
    } catch {
      setGeoError('No se pudo obtener la dirección de ese punto');
    } finally {
      setGeoBusy(false);
    }
  };

  const searchAddress = async () => {
    if (!mapEnabled || geoBusy) return;
    const query = addressQuery.trim();
    if (query.length < 3) {
      setGeoError('Escribí al menos 3 caracteres para buscar');
      return;
    }
    setGeoBusy(true);
    setGeoError(null);
    try {
      const found = await geocodeForward(query);
      if (!found) {
        setGeoError('No encontramos esa dirección');
        return;
      }
      setAddressQuery(found.label);
      emit('MAP', {
        type: 'Point',
        coordinates: [found.lng, found.lat],
        label: found.label,
      });
      focusMapOn(found.lat, found.lng);
    } catch {
      setGeoError('Error al buscar la dirección');
    } finally {
      setGeoBusy(false);
    }
  };

  const applyHome = async () => {
    if (!hasHome || !profile?.address) return;
    setGeoBusy(true);
    setGeoError(null);
    try {
      const found = await geocodeForward(homeLabel);
      if (!found) {
        setGeoError('No encontramos coordenadas para tu domicilio. Revisalo en el perfil.');
        emit('HOME', undefined);
        return;
      }
      setAddressQuery(found.label);
      emit('HOME', {
        type: 'Point',
        coordinates: [found.lng, found.lat],
        label: (homeLabel || found.label).slice(0, 200),
      });
      focusMapOn(found.lat, found.lng);
    } catch {
      setGeoError('No se pudo geocodificar tu domicilio');
      emit('HOME', undefined);
    } finally {
      setGeoBusy(false);
    }
  };

  const onModeChange = (next: MeetingLocationMode) => {
    if (disabled) return;
    setGeoError(null);
    if (next === 'CHAT') {
      emit('CHAT', undefined);
      return;
    }
    if (next === 'HOME') {
      if (!hasHome) {
        emit('HOME', undefined);
        return;
      }
      void applyHome();
      return;
    }
    emit('MAP', value.meetingLocation);
  };

  return (
    <div className="ca-tx-delivery">
      <div className="ca-tx-delivery__head">
        <h4 className="ca-tx-delivery__title">Punto de entrega</h4>
        <p className="ca-tx-delivery__lead">
          Elegí cómo van a coordinar el encuentro o la entrega del producto.
        </p>
      </div>

      <div className="ca-tx-delivery__modes" role="radiogroup" aria-label="Modo de entrega">
        {(
          [
            { id: 'MAP', label: 'Elegir en mapa' },
            { id: 'CHAT', label: 'Coordinar por chat' },
            { id: 'HOME', label: 'Usar mi domicilio' },
          ] as const
        ).map((option) => {
          const homeBlocked = option.id === 'HOME' && !hasHome;
          return (
            <label
              key={option.id}
              className={[
                'ca-tx-delivery__mode',
                mode === option.id ? 'is-active' : '',
                homeBlocked || disabled ? 'is-disabled' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <input
                type="radio"
                name="delivery-mode"
                value={option.id}
                checked={mode === option.id}
                disabled={disabled || homeBlocked}
                onChange={() => onModeChange(option.id)}
              />
              <span>{option.label}</span>
            </label>
          );
        })}
      </div>

      {mode === 'HOME' && !hasHome ? (
        <Alert variant="warning" className="mb-0">
          No tenés un domicilio completo en tu perfil (calle, ciudad y país).{' '}
          <Link to="/perfil">Completalo en configuración</Link> para usar esta opción.
        </Alert>
      ) : null}

      {mode === 'CHAT' ? (
        <p className="ca-tx-delivery__hint">
          La ubicación se coordinará después por el chat de la operación. No se guarda un
          punto en el mapa.
        </p>
      ) : null}

      {mode === 'HOME' && hasHome ? (
        <p className="ca-tx-delivery__hint">
          Usaremos: <strong>{homeLabel}</strong>
        </p>
      ) : null}

      {mode === 'MAP' ? (
        <p className="ca-tx-delivery__hint">
          Arrastrá el mapa para explorar. Hacé click para colocar el punto (también podés
          arrastrar el pin).
        </p>
      ) : null}

      {mode === 'MAP' ? (
        <Form.Group controlId="delivery-address">
          <Form.Label>Dirección</Form.Label>
          <div className="ca-tx-delivery__search">
            <Form.Control
              value={addressQuery}
              disabled={!mapEnabled}
              onChange={(event) => setAddressQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void searchAddress();
                }
              }}
              placeholder="Calle, número, barrio…"
            />
            <Button
              type="button"
              variant="outline-primary"
              disabled={!mapEnabled || geoBusy}
              onClick={() => {
                void searchAddress();
              }}
            >
              {geoBusy ? (
                <Spinner size="sm" animation="border" />
              ) : (
                <>
                  <Search size={16} className="me-1" />
                  Buscar
                </>
              )}
            </Button>
          </div>
        </Form.Group>
      ) : null}

      {(mode === 'MAP' || (mode === 'HOME' && hasHome)) && (
        <div
          className={[
            'ca-tx-delivery__map',
            mode !== 'MAP' || disabled ? 'is-disabled' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <MapContainer
            center={MONTEVIDEO}
            zoom={12}
            scrollWheelZoom={mapEnabled}
            dragging={mapEnabled}
            doubleClickZoom={mapEnabled}
            boxZoom={mapEnabled}
            keyboard={mapEnabled}
            touchZoom={mapEnabled}
            className="ca-tx-delivery__leaflet"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapViewController focus={mapFocus} />
            <MapClickHandler
              enabled={mapEnabled}
              onPick={(lat, lng) => {
                // Coloca el pin sin recentrar: el usuario ya está explorando esa zona.
                void setPoint(lat, lng, { recenter: false });
              }}
            />
            {coords ? (
              <Marker
                position={[markerLat, markerLng]}
                icon={deliveryPinIcon}
                draggable={mapEnabled}
                eventHandlers={{
                  dragend: (event) => {
                    const marker = event.target as L.Marker;
                    const pos = marker.getLatLng();
                    void setPoint(pos.lat, pos.lng, { recenter: false });
                  },
                }}
              />
            ) : null}
          </MapContainer>
        </div>
      )}
      {geoError ? <Alert variant="danger">{geoError}</Alert> : null}
    </div>
  );
}
