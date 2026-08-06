import { Alert, Badge, Spinner } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { Award, Star } from 'lucide-react';

import { useMyReputation, useMyReviews } from '../hooks/useReputation';
import { formatDateTime, formatMoney } from '@/shared/lib/money';
import { usePreferencesSnapshot } from '@/shared/preferences';
import '../styles/reputation.css';

const ROLE_LABEL: Record<string, string> = {
  BUYER: 'Comprador',
  SELLER: 'Vendedor',
  AGENT: 'Agente',
};

function stars(n: number): string {
  return '★'.repeat(Math.max(0, Math.min(5, n))) + '☆'.repeat(Math.max(0, 5 - n));
}

/** Dashboard de reputación: score, roles, ops y reseñas. */
export function ReputationPage() {
  usePreferencesSnapshot();
  const rep = useMyReputation();
  const reviews = useMyReviews();

  if (rep.isLoading) {
    return (
      <div className="ca-rep d-flex align-items-center gap-2">
        <Spinner animation="border" size="sm" />
        <span className="ca-rep__hint">Cargando reputación…</span>
      </div>
    );
  }

  if (rep.isError || !rep.data) {
    return (
      <Alert variant="danger">
        No se pudo cargar la reputación.{' '}
        <button type="button" className="btn btn-link p-0" onClick={() => void rep.refetch()}>
          Reintentar
        </button>
      </Alert>
    );
  }

  const data = rep.data;
  const comps = [
    { label: 'Calificaciones', value: data.breakdown.components.rating, max: 55 },
    { label: 'Volumen', value: data.breakdown.components.volume, max: 25 },
    { label: 'Éxito', value: data.breakdown.components.success, max: 15 },
    { label: 'KYC', value: data.breakdown.components.kyc, max: 5 },
    {
      label: 'Penalización',
      value: data.breakdown.components.fraudPenalty,
      max: 25,
      penalty: true,
    },
  ];

  return (
    <div className="ca-rep">
      <header className="ca-rep__header">
        <div>
          <p className="ca-rep__kicker">Confianza</p>
          <h2 className="ca-rep__title">
            <Award size={28} className="me-2" aria-hidden />
            Reputación
          </h2>
          <p className="ca-rep__lead">
            Score ponderado por calificaciones (buyer / seller / agent), volumen de operaciones y
            señales anti-fraude.
          </p>
        </div>
        <Link to="/perfil" className="btn btn-outline-secondary btn-sm">
          Ver perfil
        </Link>
      </header>

      <section className="ca-rep-hero">
        <div className="ca-rep-score">
          <strong>{data.score}</strong>
          <span>/ 100</span>
        </div>
        <div className="ca-rep-components">
          {comps.map((c) => (
            <div key={c.label} className="ca-rep-components__row">
              <span>{c.label}</span>
              <div className="ca-rep-components__track">
                <div
                  className={`ca-rep-components__fill${c.penalty ? ' ca-rep-components__fill--penalty' : ''}`}
                  style={{ width: `${Math.min(100, (c.value / c.max) * 100)}%` }}
                />
              </div>
              <span>{c.value.toFixed(1)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="ca-rep-grid">
        <div className="ca-rep-card">
          <span>Promedio general</span>
          <strong>
            <Star size={16} className="me-1" aria-hidden />
            {(data.rating.weightedAverage ?? data.rating.average).toFixed(1)}
          </strong>
          <span>{data.rating.count} reseñas · simple {data.rating.average.toFixed(1)}</span>
        </div>
        <div className="ca-rep-card">
          <span>Operaciones completadas</span>
          <strong>{data.operations.completed}</strong>
          <span>
            Canceladas {data.operations.cancelled} · Disputas {data.operations.disputed}
          </span>
        </div>
        <div className="ca-rep-card">
          <span>Tasa de éxito</span>
          <strong>{data.operations.successRate.toFixed(1)}%</strong>
          <span>
            Agente {data.operations.asAgent} · Volume{' '}
            {formatMoney(data.operations.totalVolumeCents, 'USD')}
          </span>
        </div>
      </section>

      <section className="ca-rep-grid">
        {(
          [
            ['Comprador', data.roleRatings.buyer],
            ['Vendedor', data.roleRatings.seller],
            ['Agente', data.roleRatings.agent],
          ] as const
        ).map(([label, role]) => (
          <div key={label} className="ca-rep-card">
            <span>Como {label}</span>
            <strong>{(role.weightedAverage ?? role.average).toFixed(1)} / 5</strong>
            <span>{role.count} calificaciones recibidas</span>
          </div>
        ))}
      </section>

      <section className="ca-rep-panel">
        <h3 className="ca-section-title">Reseñas recibidas</h3>
        {reviews.isLoading ? (
          <p className="ca-rep__hint">Cargando reseñas…</p>
        ) : !reviews.data?.length ? (
          <p className="ca-rep__hint">Todavía no recibiste reseñas públicas.</p>
        ) : (
          <ul className="ca-rep-list">
            {reviews.data.map((item) => (
              <li key={item.id}>
                <div className="d-flex flex-wrap gap-2 align-items-center">
                  <span className="ca-rep-stars" aria-label={`${item.rating} estrellas`}>
                    {stars(item.rating)}
                  </span>
                  <Badge bg="light" text="dark">
                    {ROLE_LABEL[item.reviewerRole]} → {ROLE_LABEL[item.revieweeRole]}
                  </Badge>
                  <Badge bg="secondary">peso {item.weight.toFixed(2)}</Badge>
                  {item.fraudFlags.some((f) => f !== 'NONE') ? (
                    <Badge bg="warning" text="dark">
                      fraude
                    </Badge>
                  ) : null}
                  <span className="ca-rep__hint ms-auto">
                    {formatDateTime(item.createdAt)}
                  </span>
                </div>
                {item.comment ? <p className="mb-0 mt-1">{item.comment}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
