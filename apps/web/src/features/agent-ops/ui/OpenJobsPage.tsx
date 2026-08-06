import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, Badge, Button, Form, Spinner } from 'react-bootstrap';
import { motion } from 'framer-motion';
import { BriefcaseBusiness, MapPin, Star } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import 'leaflet/dist/leaflet.css';

import { useAcceptOpenJob, useOpenJobs } from '../hooks/useAgentOps';
import type { OpenJob } from '../model/open-jobs.types';
import '../styles/agent-ops.css';
import '../styles/open-jobs.css';

import { formatMoney } from '@/shared/lib/money';
import { distanceUnitLabel, formatDistance, fromKm, toKm } from '@/shared/lib/distance';
import { usePreferencesSnapshot, useUserPreferences } from '@/shared/preferences';
import { useAppToast } from '@/shared/ui';

// Fix default marker icons with Vite bundling.
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

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

export function OpenJobsPage() {
  usePreferencesSnapshot();
  const toast = useAppToast();
  const navigate = useNavigate();
  const { distanceUnit } = useUserPreferences();
  const [lng, setLng] = useState(-56.1645);
  const [lat, setLat] = useState(-34.9011);
  const [radiusKm, setRadiusKm] = useState(15);
  const [minPay, setMinPay] = useState(0);
  const [minBuyerRating, setMinBuyerRating] = useState(0);
  const [minSellerRating, setMinSellerRating] = useState(0);
  const [maxDistanceKm, setMaxDistanceKm] = useState(15);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filters = useMemo(
    () => ({
      lng,
      lat,
      radiusKm,
      minPay: minPay > 0 ? minPay : undefined,
      minBuyerRating: minBuyerRating > 0 ? minBuyerRating : undefined,
      minSellerRating: minSellerRating > 0 ? minSellerRating : undefined,
      maxDistanceKm,
    }),
    [lng, lat, radiusKm, minPay, minBuyerRating, minSellerRating, maxDistanceKm],
  );

  const { data, isFetching, isError, refetch } = useOpenJobs(filters);
  const accept = useAcceptOpenJob();

  const items = data?.items ?? [];
  const selected = items.find((job) => job.id === selectedId) ?? items[0] ?? null;

  useEffect(() => {
    if (selected && selectedId !== selected.id) {
      setSelectedId(selected.id);
    }
  }, [selected, selectedId]);

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
        setLng(Number(pos.coords.longitude.toFixed(5)));
        setLat(Number(pos.coords.latitude.toFixed(5)));
      },
      () => setError('No se pudo obtener tu ubicación'),
    );
  };

  return (
    <div className="ca-agent-ops ca-open-jobs">
      <header className="ca-agent-ops__header">
        <div>
          <p className="ca-agent-ops__kicker">Agente</p>
          <h2 className="ca-agent-ops__title">Trabajos abiertos</h2>
          <p className="ca-agent-ops__lead">
            Mapa y listado de operaciones sin intermediario. Filtrá por distancia, pago y
            calificaciones.
          </p>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <Badge bg="light" text="dark">
            {items.length}
          </Badge>
          <Link to="/agente/ofertas" className="btn btn-outline-secondary">
            Ofertas
          </Link>
        </div>
      </header>

      <section className="ca-agent-ops-panel">
        <h3 className="mb-0">Filtros</h3>
        <Form className="ca-open-jobs__filters">
          <Form.Group>
            <Form.Label>Lng</Form.Label>
            <Form.Control
              type="number"
              step="0.0001"
              value={lng}
              onChange={(e) => setLng(Number(e.target.value))}
            />
          </Form.Group>
          <Form.Group>
            <Form.Label>Lat</Form.Label>
            <Form.Control
              type="number"
              step="0.0001"
              value={lat}
              onChange={(e) => setLat(Number(e.target.value))}
            />
          </Form.Group>
          <Form.Group>
            <Form.Label>Radio ({distanceUnitLabel(distanceUnit)})</Form.Label>
            <Form.Control
              type="number"
              min={1}
              max={distanceUnit === 'MI' ? 62 : 100}
              value={Number(fromKm(radiusKm, distanceUnit).toFixed(2))}
              onChange={(e) => {
                const value = toKm(Number(e.target.value), distanceUnit);
                setRadiusKm(value);
                setMaxDistanceKm(value);
              }}
            />
          </Form.Group>
          <Form.Group>
            <Form.Label>Pago mín.</Form.Label>
            <Form.Control
              type="number"
              min={0}
              value={minPay}
              onChange={(e) => setMinPay(Number(e.target.value))}
            />
          </Form.Group>
          <Form.Group>
            <Form.Label>★ Comprador</Form.Label>
            <Form.Control
              type="number"
              min={0}
              max={5}
              step={0.1}
              value={minBuyerRating}
              onChange={(e) => setMinBuyerRating(Number(e.target.value))}
            />
          </Form.Group>
          <Form.Group>
            <Form.Label>★ Vendedor</Form.Label>
            <Form.Control
              type="number"
              min={0}
              max={5}
              step={0.1}
              value={minSellerRating}
              onChange={(e) => setMinSellerRating(Number(e.target.value))}
            />
          </Form.Group>
          <div className="ca-form-actions align-self-end">
            <Button type="button" variant="outline-secondary" onClick={useMyLocation}>
              Mi ubicación
            </Button>
            <Button type="button" className="ca-btn-primary" onClick={() => void refetch()}>
              Aplicar
            </Button>
          </div>
        </Form>
      </section>

      {error || isError ? (
        <Alert variant="danger">{error || 'No se pudieron cargar los trabajos.'}</Alert>
      ) : null}

      <div className="ca-open-jobs__layout">
        <section className="ca-open-jobs__map ca-agent-ops-panel">
          <MapContainer
            center={[lat, lng]}
            zoom={12}
            scrollWheelZoom
            className="ca-open-jobs__map-canvas"
          >
            <MapFocus center={[lat, lng]} zoom={12} />
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Circle
              center={[lat, lng]}
              radius={radiusKm * 1000}
              pathOptions={{ color: '#01285D', fillColor: '#55C5B5', fillOpacity: 0.12 }}
            />
            <Marker position={[lat, lng]}>
              <Popup>Tu posición de búsqueda</Popup>
            </Marker>
            {items.map((job) => (
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
                  {formatMoney(job.amountCents, job.currency)} ·{' '}
                  {formatDistance(job.distanceKm, distanceUnit, 1)}
                </Popup>
              </Marker>
            ))}
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
                      <Badge bg="primary">{formatMoney(job.amountCents, job.currency)}</Badge>
                    </div>
                    <div className="ca-agent-ops-list__meta">
                      <MapPin size={14} className="me-1" />
                      {formatDistance(job.distanceKm, distanceUnit, 2)} ·{' '}
                      {job.meeting.label || job.code}
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
