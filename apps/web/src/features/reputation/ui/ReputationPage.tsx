import { useEffect, useState } from 'react';
import { Alert, Badge, Button, Nav, Spinner, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { ChevronLeft, ChevronRight, Star } from 'lucide-react';
import { Link } from 'react-router-dom';

import { useAgentOnboarding } from '@/features/agent-onboarding/hooks/useAgentOnboarding';
import { formatDateTime, formatMoney } from '@/shared/lib/money';
import { usePreferencesSnapshot } from '@/shared/preferences';

import { useMyReputation, useMyReviews } from '../hooks/useReputation';
import type { PartyRole } from '../model/types';
import '../styles/reputation.css';

const ROLE_LABEL: Record<PartyRole, string> = {
  BUYER: 'Comprador',
  SELLER: 'Vendedor',
  AGENT: 'Agente',
};

const ROLE_TABS: PartyRole[] = ['BUYER', 'SELLER', 'AGENT'];

function stars(n: number): string {
  return '★'.repeat(Math.max(0, Math.min(5, n))) + '☆'.repeat(Math.max(0, 5 - n));
}

/** Dashboard de reputación: score, roles, ops y reseñas. */
export function ReputationPage() {
  usePreferencesSnapshot();
  const rep = useMyReputation();
  const onboarding = useAgentOnboarding();
  const isActiveAgent = onboarding.data?.data?.status === 'ACTIVE';

  const [roleTab, setRoleTab] = useState<PartyRole>('BUYER');
  const [page, setPage] = useState(1);
  const reviews = useMyReviews(roleTab, page);

  useEffect(() => {
    if (roleTab === 'AGENT' && !isActiveAgent) {
      setRoleTab('BUYER');
      setPage(1);
    }
  }, [isActiveAgent, roleTab]);

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
  ];

  const reviewItems = reviews.data?.items ?? [];
  const total = reviews.data?.total ?? 0;
  const totalPages = reviews.data?.totalPages ?? 0;
  const currentPage = reviews.data?.page ?? page;

  const selectTab = (role: PartyRole) => {
    if (role === 'AGENT' && !isActiveAgent) return;
    setRoleTab(role);
    setPage(1);
  };

  return (
    <div className="ca-rep">
      <header className="ca-rep__header">
        <div>
          <p className="ca-rep__kicker">Confianza</p>
          <h2 className="ca-rep__title">Reputación</h2>
          <p className="ca-rep__lead">
            Score basado en calificaciones por rol, volumen de operaciones y verificación de
            identidad.{' '}
            <Link to="/ayuda#reputacion">Cómo se calcula</Link>
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
                  className="ca-rep-components__fill"
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
          <span>{data.rating.count} reseñas</span>
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
            {formatMoney(data.operations.totalVolumeCents, 'UYU')}
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
        <div className="ca-rep-reviews__head">
          <h3 className="ca-section-title mb-0">Reseñas recibidas</h3>
        </div>

        <Nav variant="pills" className="ca-rep-reviews__tabs" role="tablist">
          {ROLE_TABS.map((role) => {
            const disabled = role === 'AGENT' && !isActiveAgent;
            const tab = (
              <Nav.Link
                as="button"
                type="button"
                active={roleTab === role}
                disabled={disabled}
                onClick={() => selectTab(role)}
                className="ca-rep-reviews__tab"
              >
                {ROLE_LABEL[role]}
              </Nav.Link>
            );

            if (!disabled) {
              return (
                <Nav.Item key={role} role="presentation">
                  {tab}
                </Nav.Item>
              );
            }

            return (
              <Nav.Item key={role} role="presentation">
                <OverlayTrigger
                  placement="top"
                  overlay={
                    <Tooltip id="rep-agent-tab-disabled">
                      Disponible cuando tu agencia esté activa.
                    </Tooltip>
                  }
                >
                  <span className="ca-rep-reviews__tab-wrap">{tab}</span>
                </OverlayTrigger>
              </Nav.Item>
            );
          })}
        </Nav>

        {reviews.isLoading ? (
          <p className="ca-rep__hint d-flex align-items-center gap-2">
            <Spinner animation="border" size="sm" />
            Cargando reseñas…
          </p>
        ) : reviews.isError ? (
          <Alert variant="danger" className="mb-0">
            No se pudieron cargar las reseñas.{' '}
            <button
              type="button"
              className="btn btn-link p-0 align-baseline"
              onClick={() => void reviews.refetch()}
            >
              Reintentar
            </button>
          </Alert>
        ) : !reviewItems.length ? (
          <p className="ca-rep__hint">
            Todavía no recibiste reseñas como {ROLE_LABEL[roleTab].toLowerCase()}.
          </p>
        ) : (
          <>
            <ul className="ca-rep-list">
              {reviewItems.map((item) => (
                <li key={item.id}>
                  <div className="d-flex flex-wrap gap-2 align-items-center">
                    <span className="ca-rep-stars" aria-label={`${item.rating} estrellas`}>
                      {stars(item.rating)}
                    </span>
                    <Badge bg="light" text="dark">
                      {ROLE_LABEL[item.reviewerRole]} → {ROLE_LABEL[item.revieweeRole]}
                    </Badge>
                    <span className="ca-rep__hint ms-auto">
                      {formatDateTime(item.createdAt)}
                    </span>
                  </div>
                  {item.comment ? <p className="mb-0 mt-1">{item.comment}</p> : null}
                </li>
              ))}
            </ul>

            {totalPages > 1 ? (
              <nav className="ca-rep-reviews__pager" aria-label="Paginación de reseñas">
                <Button
                  type="button"
                  variant="outline-secondary"
                  size="sm"
                  disabled={currentPage <= 1 || reviews.isFetching}
                  onClick={() => setPage(Math.max(1, currentPage - 1))}
                  aria-label="Anterior"
                >
                  <ChevronLeft size={16} aria-hidden />
                  Anterior
                </Button>
                <span className="ca-rep-reviews__pager-status">
                  Página {currentPage} de {totalPages}
                  <span className="ca-rep__hint"> · {total} reseñas</span>
                </span>
                <Button
                  type="button"
                  variant="outline-secondary"
                  size="sm"
                  disabled={currentPage >= totalPages || reviews.isFetching}
                  onClick={() => setPage(currentPage + 1)}
                  aria-label="Siguiente"
                >
                  Siguiente
                  <ChevronRight size={16} aria-hidden />
                </Button>
              </nav>
            ) : total > 0 ? (
              <p className="ca-rep-reviews__pager-solo">
                {total} {total === 1 ? 'reseña' : 'reseñas'}
              </p>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
