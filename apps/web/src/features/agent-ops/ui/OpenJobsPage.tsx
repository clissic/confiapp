import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Badge,
  Button,
  Form,
  OverlayTrigger,
  Popover,
  Spinner,
} from 'react-bootstrap';
import { motion } from 'framer-motion';
import { BriefcaseBusiness, CircleHelp, MapPin, Package, PackageCheck, Star } from 'lucide-react';
import {
  MapContainer,
  Marker,
  Popup,
  Circle,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import 'leaflet/dist/leaflet.css';
import {
  AGENT_FEE_TIERS,
  amountCentsToUyu,
  commissionForProductUyu,
  formatFeeTierPopoverLine,
  formatFeeTierSelectLabel,
} from '@confiapp/shared';

import { ThemeAwareTileLayer } from '@/shared/ui/map/ThemeAwareTileLayer';
import { formatOperationMoney } from '@/shared/lib/money';
import { distanceUnitLabel, formatDistance, fromKm, toKm } from '@/shared/lib/distance';
import { usePreferencesSnapshot, useUserPreferences } from '@/shared/preferences';
import { useAppToast } from '@/shared/ui';

import { useAcceptOpenJob, useOpenJobs } from '../hooks/useAgentOps';
import {
  openJobPlaceLabel,
  type OpenJob,
  type OpenJobsFilters,
} from '../model/open-jobs.types';
import '../styles/agent-ops.css';
import '../styles/open-jobs.css';

// Fix default marker icons with Vite bundling.
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const MONTEVIDEO: [number, number] = [-34.9011, -56.1645];

function MapFocus({
  center,
  zoom,
}: {
  center: [number, number];
  zoom: number;
}) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

function MapClickHandler({
  onPick,
}: {
  onPick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(event) {
      onPick(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

function CommissionHelpPopover() {
  return (
    <Popover id="ca-open-jobs-commission-help">
      <Popover.Header as="h3">Tarifas de intermediación</Popover.Header>
      <Popover.Body>
        <ul className="ca-open-jobs__fee-list mb-0">
          {AGENT_FEE_TIERS.map((tier) => (
            <li key={tier.commissionUyu}>{formatFeeTierPopoverLine(tier)}</li>
          ))}
        </ul>
      </Popover.Body>
    </Popover>
  );
}

export function OpenJobsPage() {
  usePreferencesSnapshot();
  const toast = useAppToast();
  const navigate = useNavigate();
  const { distanceUnit } = useUserPreferences();

  const [pinLng, setPinLng] = useState(MONTEVIDEO[1]);
  const [pinLat, setPinLat] = useState(MONTEVIDEO[0]);
  const [radiusKm, setRadiusKm] = useState(15);
  const [minCommissionUyu, setMinCommissionUyu] = useState<number | ''>('');
  const [minBuyerRating, setMinBuyerRating] = useState(0);
  const [maxBuyerRating, setMaxBuyerRating] = useState(5);
  const [minSellerRating, setMinSellerRating] = useState(0);
  const [maxSellerRating, setMaxSellerRating] = useState(5);

  const [applied, setApplied] = useState<OpenJobsFilters>(() => ({
    lng: MONTEVIDEO[1],
    lat: MONTEVIDEO[0],
    radiusKm: 15,
  }));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filterError, setFilterError] = useState<string | null>(null);

  const { data, isFetching, isError } = useOpenJobs(applied);
  const accept = useAcceptOpenJob();

  const items = data?.items ?? [];
  const selected = items.find((job) => job.id === selectedId) ?? items[0] ?? null;

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lng = Number(pos.coords.longitude.toFixed(5));
        const lat = Number(pos.coords.latitude.toFixed(5));
        setPinLng(lng);
        setPinLat(lat);
        setApplied((prev) => ({ ...prev, lng, lat }));
      },
      () => {
        /* Mantener Montevideo */
      },
      { maximumAge: 60_000, timeout: 8_000 },
    );
  }, []);

  useEffect(() => {
    if (selected && selectedId !== selected.id) {
      setSelectedId(selected.id);
    }
  }, [selected, selectedId]);

  const radiusDisplay = useMemo(
    () => Number(fromKm(radiusKm, distanceUnit).toFixed(2)),
    [radiusKm, distanceUnit],
  );

  const onApplyFilters = () => {
    if (minBuyerRating > maxBuyerRating) {
      setFilterError('La calificación mín. del comprador no puede superar la máx.');
      return;
    }
    if (minSellerRating > maxSellerRating) {
      setFilterError('La calificación mín. del vendedor no puede superar la máx.');
      return;
    }
    setFilterError(null);
    setError(null);
    setApplied({
      lng: pinLng,
      lat: pinLat,
      radiusKm,
      minCommissionUyu: minCommissionUyu === '' ? undefined : minCommissionUyu,
      minBuyerRating: minBuyerRating > 0 ? minBuyerRating : undefined,
      maxBuyerRating: maxBuyerRating < 5 ? maxBuyerRating : undefined,
      minSellerRating: minSellerRating > 0 ? minSellerRating : undefined,
      maxSellerRating: maxSellerRating < 5 ? maxSellerRating : undefined,
    });
  };

  const onAccept = async (job: OpenJob) => {
    setError(null);
    try {
      await accept.mutateAsync(job.code);
      toast.success(`Aceptaste el trabajo ${job.code}. Ya figurás como intermediario.`);
      navigate(`/operaciones/${job.code}`, { state: { agentAccepted: true } });
    } catch {
      setError('No se pudo aceptar el trabajo. Puede que otro agente lo haya tomado.');
    }
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocalización no disponible en este navegador');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPinLng(Number(pos.coords.longitude.toFixed(5)));
        setPinLat(Number(pos.coords.latitude.toFixed(5)));
      },
      () => setError('No se pudo obtener tu ubicación'),
    );
  };

  const estimatedCommissionLabel = (job: OpenJob) => {
    const uyu = amountCentsToUyu(job.amountCents, job.currency);
    const fee = commissionForProductUyu(uyu);
    return `Comisión ~ ${formatOperationMoney(fee * 100, 'UYU')}`;
  };

  return (
    <div className="ca-agent-ops ca-open-jobs">
      <header className="ca-agent-ops__header">
        <div>
          <p className="ca-agent-ops__kicker">Agente</p>
          <h2 className="ca-agent-ops__title">Trabajos abiertos</h2>
          <p className="ca-agent-ops__lead">
            Poné el pin en el mapa, elegí el radio y filtrá por comisión y calificaciones.
          </p>
        </div>
        <Badge bg="light" text="dark">
          {items.length}
        </Badge>
      </header>

      <section className="ca-agent-ops-panel">
        <h3 className="mb-0">Filtros</h3>
        <Form
          className="ca-open-jobs__filters"
          onSubmit={(event) => {
            event.preventDefault();
            onApplyFilters();
          }}
        >
          <Form.Group>
            <Form.Label>Radio ({distanceUnitLabel(distanceUnit)})</Form.Label>
            <Form.Control
              type="number"
              min={1}
              max={distanceUnit === 'MI' ? 62 : 100}
              step={0.5}
              value={radiusDisplay}
              onChange={(e) => {
                setRadiusKm(toKm(Number(e.target.value), distanceUnit));
              }}
            />
          </Form.Group>

          <Form.Group>
            <Form.Label className="ca-open-jobs__label-with-help">
              <span>Comisión mín.</span>
              <OverlayTrigger
                trigger={['click', 'focus']}
                placement="auto"
                overlay={<CommissionHelpPopover />}
                rootClose
              >
                <button
                  type="button"
                  className="ca-open-jobs__help-btn"
                  aria-label="Ver tarifas de comisión"
                >
                  <CircleHelp size={16} strokeWidth={1.75} />
                </button>
              </OverlayTrigger>
            </Form.Label>
            <Form.Select
              value={minCommissionUyu === '' ? '' : String(minCommissionUyu)}
              onChange={(e) => {
                const raw = e.target.value;
                setMinCommissionUyu(raw === '' ? '' : Number(raw));
              }}
            >
              <option value="">Cualquiera</option>
              {AGENT_FEE_TIERS.map((tier) => (
                <option key={tier.commissionUyu} value={tier.commissionUyu}>
                  {formatFeeTierSelectLabel(tier)}
                </option>
              ))}
            </Form.Select>
          </Form.Group>

          <Form.Group className="ca-open-jobs__rating-group">
            <Form.Label>
              <Star size={14} className="me-1" aria-hidden />
              Comprador
            </Form.Label>
            <div className="ca-open-jobs__rating-range">
              <Form.Control
                type="number"
                min={0}
                max={5}
                step={0.1}
                value={minBuyerRating}
                aria-label="Calificación mínima comprador"
                onChange={(e) => setMinBuyerRating(Number(e.target.value))}
              />
              <span className="ca-open-jobs__rating-sep" aria-hidden>
                –
              </span>
              <Form.Control
                type="number"
                min={0}
                max={5}
                step={0.1}
                value={maxBuyerRating}
                aria-label="Calificación máxima comprador"
                onChange={(e) => setMaxBuyerRating(Number(e.target.value))}
              />
            </div>
          </Form.Group>

          <Form.Group className="ca-open-jobs__rating-group">
            <Form.Label>
              <Star size={14} className="me-1" aria-hidden />
              Vendedor
            </Form.Label>
            <div className="ca-open-jobs__rating-range">
              <Form.Control
                type="number"
                min={0}
                max={5}
                step={0.1}
                value={minSellerRating}
                aria-label="Calificación mínima vendedor"
                onChange={(e) => setMinSellerRating(Number(e.target.value))}
              />
              <span className="ca-open-jobs__rating-sep" aria-hidden>
                –
              </span>
              <Form.Control
                type="number"
                min={0}
                max={5}
                step={0.1}
                value={maxSellerRating}
                aria-label="Calificación máxima vendedor"
                onChange={(e) => setMaxSellerRating(Number(e.target.value))}
              />
            </div>
          </Form.Group>

          <div className="ca-form-actions align-self-end">
            <Button type="button" variant="outline-secondary" onClick={useMyLocation}>
              Mi ubicación
            </Button>
            <Button type="submit" className="ca-btn-primary">
              Aplicar
            </Button>
          </div>
        </Form>
        {filterError ? (
          <Alert variant="warning" className="mb-0 mt-2">
            {filterError}
          </Alert>
        ) : null}
        <p className="ca-open-jobs__hint mb-0 mt-2">
          Tocá el mapa para mover el pin de búsqueda. El círculo muestra el radio.
        </p>
      </section>

      {error || isError ? (
        <Alert variant="danger">{error || 'No se pudieron cargar los trabajos.'}</Alert>
      ) : null}

      <div className="ca-open-jobs__layout">
        <section className="ca-open-jobs__map ca-agent-ops-panel">
          <MapContainer
            center={[pinLat, pinLng]}
            zoom={12}
            scrollWheelZoom
            className="ca-open-jobs__map-canvas"
          >
            <MapFocus center={[pinLat, pinLng]} zoom={12} />
            <MapClickHandler
              onPick={(lat, lng) => {
                setPinLat(Number(lat.toFixed(5)));
                setPinLng(Number(lng.toFixed(5)));
              }}
            />
            <ThemeAwareTileLayer />
            <Circle
              center={[pinLat, pinLng]}
              radius={radiusKm * 1000}
              pathOptions={{ color: '#01285D', fillColor: '#55C5B5', fillOpacity: 0.12 }}
            />
            <Marker
              position={[pinLat, pinLng]}
              draggable
              eventHandlers={{
                dragend: (event) => {
                  const marker = event.target as L.Marker;
                  const { lat, lng } = marker.getLatLng();
                  setPinLat(Number(lat.toFixed(5)));
                  setPinLng(Number(lng.toFixed(5)));
                },
              }}
            >
              <Popup>Punto de búsqueda — arrastrá o tocá el mapa</Popup>
            </Marker>
            {items.flatMap((job) => {
              const markers = [];
              if (job.pickup?.hasPoint && job.pickup.lat != null && job.pickup.lng != null) {
                markers.push(
                  <Marker
                    key={`${job.id}-pickup`}
                    position={[job.pickup.lat, job.pickup.lng]}
                    eventHandlers={{
                      click: () => setSelectedId(job.id),
                    }}
                  >
                    <Popup>
                      <strong>Retiro · {job.title}</strong>
                      <br />
                      {openJobPlaceLabel(job.pickup)}
                    </Popup>
                  </Marker>,
                );
              }
              if (
                job.delivery?.hasPoint &&
                job.delivery.lat != null &&
                job.delivery.lng != null
              ) {
                markers.push(
                  <Marker
                    key={`${job.id}-delivery`}
                    position={[job.delivery.lat, job.delivery.lng]}
                    eventHandlers={{
                      click: () => setSelectedId(job.id),
                    }}
                  >
                    <Popup>
                      <strong>Entrega · {job.title}</strong>
                      <br />
                      {openJobPlaceLabel(job.delivery)}
                    </Popup>
                  </Marker>,
                );
              }
              if (markers.length === 0) {
                markers.push(
                  <Marker
                    key={job.id}
                    position={[job.meeting.lat, job.meeting.lng]}
                    eventHandlers={{
                      click: () => setSelectedId(job.id),
                    }}
                  >
                    <Popup>
                      <strong>{job.title}</strong>
                      <br />
                      {formatOperationMoney(job.amountCents, job.currency)} ·{' '}
                      {formatDistance(job.distanceKm, distanceUnit, 1)}
                    </Popup>
                  </Marker>,
                );
              }
              return markers;
            })}
          </MapContainer>
        </section>

        <section className="ca-agent-ops-panel ca-open-jobs__list-panel">
          <div className="ca-agent-ops-list__row">
            <h3 className="mb-0">Lista</h3>
            {isFetching ? <Spinner size="sm" animation="border" /> : null}
          </div>

          {items.length === 0 && !isFetching ? (
            <div className="text-center py-4">
              <BriefcaseBusiness size={32} className="mb-2" />
              <p className="ca-agent-ops__lead mb-0">No hay trabajos abiertos con estos filtros.</p>
            </div>
          ) : (
            <ul className="ca-agent-ops-list">
              {items.map((job, index) => {
                const active = selected?.id === job.id;
                return (
                  <motion.li
                    key={job.id}
                    className={[
                      'ca-agent-ops-list__item',
                      active ? 'ca-open-jobs__item--active' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    onClick={() => setSelectedId(job.id)}
                  >
                    <div className="ca-agent-ops-list__row">
                      <strong>{job.title}</strong>
                      <Badge bg="primary">
                        {formatOperationMoney(job.amountCents, job.currency)}
                      </Badge>
                    </div>
                    <div className="ca-agent-ops-list__meta">
                      <MapPin size={14} className="me-1" />
                      A {formatDistance(job.distanceKm, distanceUnit, 2)} de tu punto
                      {job.routeKm != null
                        ? ` · Recorrido ${formatDistance(job.routeKm, distanceUnit, 1)}`
                        : ''}
                    </div>
                    <div className="ca-open-jobs__route" aria-label="Ruta de la entrega">
                      <div className="ca-open-jobs__route-stop">
                        <span className="ca-open-jobs__route-icon" aria-hidden>
                          <Package size={15} strokeWidth={1.75} />
                        </span>
                        <div>
                          <span className="ca-open-jobs__route-label">Retiro · vendedor</span>
                          <span className="ca-open-jobs__route-value">
                            {openJobPlaceLabel(job.pickup)}
                          </span>
                        </div>
                      </div>
                      <div className="ca-open-jobs__route-stop">
                        <span className="ca-open-jobs__route-icon ca-open-jobs__route-icon--delivery" aria-hidden>
                          <PackageCheck size={15} strokeWidth={1.75} />
                        </span>
                        <div>
                          <span className="ca-open-jobs__route-label">Entrega · comprador</span>
                          <span className="ca-open-jobs__route-value">
                            {openJobPlaceLabel(job.delivery)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="ca-open-jobs__commission-hint">
                      {estimatedCommissionLabel(job)}
                    </div>
                    <div className="ca-open-jobs__ratings">
                      <span>
                        <Star size={14} className="me-1" />
                        Comprador {job.buyer.name}: {job.buyer.ratingAverage.toFixed(1)} (
                        {job.buyer.ratingCount})
                      </span>
                      <span>
                        <Star size={14} className="me-1" />
                        Vendedor {job.seller.name}: {job.seller.ratingAverage.toFixed(1)} (
                        {job.seller.ratingCount})
                      </span>
                    </div>
                    <div className="ca-form-actions mt-2">
                      <Button
                        className="ca-btn-cta"
                        disabled={accept.isPending}
                        onClick={(event) => {
                          event.stopPropagation();
                          void onAccept(job);
                        }}
                      >
                        {accept.isPending ? (
                          <Spinner size="sm" animation="border" />
                        ) : (
                          'Aceptar trabajo'
                        )}
                      </Button>
                    </div>
                  </motion.li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
