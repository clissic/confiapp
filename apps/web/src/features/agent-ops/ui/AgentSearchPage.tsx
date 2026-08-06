import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Badge, Button, Form, Spinner } from 'react-bootstrap';
import { motion } from 'framer-motion';
import { MapPin, Radar } from 'lucide-react';

import { useAgentSearch, useOfferAssignment } from '../hooks/useAgentOps';
import { distanceUnitLabel, formatDistance, fromKm, toKm } from '@/shared/lib/distance';
import { formatMoney } from '@/shared/lib/money';
import { usePreferencesSnapshot, useUserPreferences } from '@/shared/preferences';
import { useAppToast } from '@/shared/ui';
import '../styles/agent-ops.css';

export function AgentSearchPage() {
  usePreferencesSnapshot();
  const toast = useAppToast();
  const { distanceUnit } = useUserPreferences();
  // Montevideo por defecto (Mercado Pago Uruguay / MLU)
  const [lng, setLng] = useState(-56.1645);
  const [lat, setLat] = useState(-34.9011);
  const [radiusKm, setRadiusKm] = useState(10);
  const [txCode, setTxCode] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const search = useAgentSearch({ lng, lat, radiusKm, enabled });
  const offer = useOfferAssignment();

  const items = useMemo(() => search.data?.items ?? [], [search.data?.items]);

  const onSearch = (event: FormEvent) => {
    event.preventDefault();
    setEnabled(true);
    void search.refetch();
  };

  const onOffer = async () => {
    setError(null);
    if (!/^CONF-[A-Z0-9]{6,16}$/i.test(txCode.trim())) {
      setError('Ingresá un código de operación válido (CONF-…)');
      return;
    }
    try {
      await offer.mutateAsync({
        transactionCode: txCode.trim().toUpperCase(),
        lng,
        lat,
        radiusKm,
        expiresInSeconds: 120,
      });
      toast.success('Oferta enviada al mejor agente. Notificación push + WebSocket despachadas.');
    } catch {
      setError('No se pudo ofrecer la asignación. Revisá la operación y los agentes.');
    }
  };

  return (
    <div className="ca-agent-ops">
      <header className="ca-agent-ops__header">
        <div>
          <p className="ca-agent-ops__kicker">Agentes</p>
          <h2 className="ca-agent-ops__title">Búsqueda geoespacial</h2>
          <p className="ca-agent-ops__lead">
            Índice 2dsphere, radio configurable, disponibilidad, horario, calificación y carga
            activa.
          </p>
        </div>
        <Link to="/agente/ofertas" className="btn btn-outline-secondary">
          Ver ofertas
        </Link>
      </header>

      <section className="ca-agent-ops-panel">
        <Form className="ca-form-grid" onSubmit={onSearch}>
          <Form.Group controlId="lng">
            <Form.Label>Longitud</Form.Label>
            <Form.Control
              type="number"
              step="0.0001"
              value={lng}
              onChange={(e) => setLng(Number(e.target.value))}
            />
          </Form.Group>
          <Form.Group controlId="lat">
            <Form.Label>Latitud</Form.Label>
            <Form.Control
              type="number"
              step="0.0001"
              value={lat}
              onChange={(e) => setLat(Number(e.target.value))}
            />
          </Form.Group>
          <Form.Group controlId="radius">
            <Form.Label>Radio ({distanceUnitLabel(distanceUnit)})</Form.Label>
            <Form.Control
              type="number"
              min={distanceUnit === 'MI' ? 0.3 : 0.5}
              max={distanceUnit === 'MI' ? 62 : 100}
              step="0.5"
              value={Number(fromKm(radiusKm, distanceUnit).toFixed(2))}
              onChange={(e) => setRadiusKm(toKm(Number(e.target.value), distanceUnit))}
            />
          </Form.Group>
          <Button type="submit" className="ca-btn-primary">
            <Radar size={16} className="me-1" />
            Buscar
          </Button>
        </Form>
      </section>

      {error ? <Alert variant="danger">{error}</Alert> : null}

      <section className="ca-agent-ops-panel">
        <div className="ca-agent-ops-list__row">
          <h3 className="mb-0">Resultados</h3>
          <Badge bg="light" text="dark">
            {items.length}
          </Badge>
        </div>

        {search.isFetching ? (
          <div className="d-flex align-items-center gap-2">
            <Spinner size="sm" animation="border" />
            Buscando agentes…
          </div>
        ) : null}

        {!search.isFetching && items.length === 0 ? (
          <p className="ca-agent-ops__lead mb-0">Ningún agente cumple los filtros ahora.</p>
        ) : (
          <ul className="ca-agent-ops-list">
            {items.map((agent, index) => (
              <motion.li
                key={agent.id}
                className="ca-agent-ops-list__item"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
              >
                <div className="ca-agent-ops-list__row">
                  <strong>{agent.displayName || agent.fullName}</strong>
                  <Badge bg="primary">score {agent.score.toFixed(2)}</Badge>
                </div>
                <div className="ca-agent-ops-list__meta">
                  <MapPin size={14} className="me-1" />
                  {formatDistance(agent.distanceKm, distanceUnit, 2)} · ★{' '}
                  {agent.ratingAverage.toFixed(1)} ({agent.ratingCount}) · trabajos{' '}
                  {agent.activeJobs}/{agent.maxActiveTransactions} ·{' '}
                  {formatMoney(agent.hourlyRateCents, agent.currency)}
                </div>
                <div className="ca-agent-ops-list__meta">
                  Cobertura {formatDistance(agent.coverageRadiusKm, distanceUnit, 0)} ·{' '}
                  {agent.locationLabel || 'Sin etiqueta'} · {agent.timezone}
                </div>
              </motion.li>
            ))}
          </ul>
        )}
      </section>

      <section className="ca-agent-ops-panel">
        <h3 className="mb-0">Ofrecer asignación</h3>
        <p className="ca-agent-ops__lead">
          Envía la oferta al mejor score. Si expira o rechaza, se reasignará automáticamente.
        </p>
        <div className="ca-form-actions">
          <Form.Control
            style={{ maxWidth: 220 }}
            placeholder="CONF-XXXXXXXX"
            value={txCode}
            onChange={(e) => setTxCode(e.target.value.toUpperCase())}
          />
          <Button
            className="ca-btn-cta"
            disabled={offer.isPending}
            onClick={() => void onOffer()}
          >
            {offer.isPending ? <Spinner size="sm" animation="border" /> : 'Ofrecer al top agente'}
          </Button>
        </div>
      </section>
    </div>
  );
}
