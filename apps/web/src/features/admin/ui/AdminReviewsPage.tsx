import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Accordion,
  Alert,
  Badge,
  Button,
  Form,
  OverlayTrigger,
  Spinner,
  Tooltip,
} from 'react-bootstrap';
import { ChevronLeft, ChevronRight, Filter } from 'lucide-react';

import { useAdminReviews } from '@/features/reputation/hooks/useReputation';
import {
  activeReviewSignals,
  reviewSignalMeta,
} from '@/features/reputation/model/review-signals';
import { formatDateTime } from '@/shared/lib/money';

import '../styles/admin-reviews.css';

const ROLE_LABEL: Record<string, string> = {
  BUYER: 'Comprador',
  SELLER: 'Vendedor',
  AGENT: 'Agente',
};

function stars(n: number): string {
  return '★'.repeat(Math.max(0, Math.min(5, n))) + '☆'.repeat(Math.max(0, 5 - n));
}

function TipBadge({
  id,
  label,
  tip,
  bg = 'secondary',
  text,
}: {
  id: string;
  label: string;
  tip: string;
  bg?: string;
  text?: 'dark';
}) {
  return (
    <OverlayTrigger
      placement="top"
      overlay={<Tooltip id={`tip-${id}`}>{tip}</Tooltip>}
    >
      <Badge bg={bg} text={text} className="ca-admin-reviews__tip-badge" tabIndex={0}>
        {label}
      </Badge>
    </OverlayTrigger>
  );
}

/** Admin: reseñas recientes con peso y señales de ponderación. */
export function AdminReviewsPage() {
  const [page, setPage] = useState(1);
  const [onlyFlagged, setOnlyFlagged] = useState(false);

  const reviewsQuery = useAdminReviews({ page, flaggedOnly: onlyFlagged });
  const items = reviewsQuery.data?.items ?? [];
  const total = reviewsQuery.data?.total ?? 0;
  const totalPages = reviewsQuery.data?.totalPages ?? 0;
  const activeFilterCount = onlyFlagged ? 1 : 0;

  return (
    <div className="ca-admin-reviews">
      <header className="ca-admin-reviews__header">
        <p className="ca-admin-reviews__kicker">Administración</p>
        <h1 className="ca-admin-reviews__title">Reseñas</h1>
        <p className="ca-admin-reviews__lead">
          Peso y señales de ponderación (solo visibles acá). Pasá el cursor sobre cada badge para
          ver el significado.
        </p>
      </header>

      <Accordion className="ca-admin-reviews-filters">
        <Accordion.Item eventKey="0">
          <Accordion.Header>
            <span className="ca-admin-reviews-filters__header">
              <Filter size={15} strokeWidth={1.75} aria-hidden />
              Filtros
              {activeFilterCount > 0 ? (
                <Badge bg="secondary" pill className="ca-admin-reviews-filters__count">
                  {activeFilterCount}
                </Badge>
              ) : null}
            </span>
          </Accordion.Header>
          <Accordion.Body>
            <div className="ca-admin-reviews-filters__body">
              <Form.Check
                type="switch"
                id="admin-reviews-flagged"
                label="Solo con señales o peso reducido"
                checked={onlyFlagged}
                onChange={(e) => {
                  setOnlyFlagged(e.target.checked);
                  setPage(1);
                }}
              />
              <p className="ca-admin-reviews-filters__hint">
                Muestra reseñas con peso menor a 1 o con alguna señal de ponderación activa.
              </p>
            </div>
          </Accordion.Body>
        </Accordion.Item>
      </Accordion>

      <div className="ca-admin-reviews__meta">
        {total} registro{total === 1 ? '' : 's'}
      </div>

      {reviewsQuery.isLoading ? (
        <div className="ca-admin-reviews__quiet">
          <Spinner animation="border" size="sm" />
          <span>Cargando reseñas…</span>
        </div>
      ) : reviewsQuery.isError ? (
        <Alert variant="danger" className="mb-0">
          No se pudieron cargar las reseñas.{' '}
          <button
            type="button"
            className="btn btn-link p-0 align-baseline"
            onClick={() => void reviewsQuery.refetch()}
          >
            Reintentar
          </button>
        </Alert>
      ) : !items.length ? (
        <p className="ca-admin-reviews__empty">
          {onlyFlagged
            ? 'No hay reseñas con señales o peso reducido.'
            : 'No hay reseñas para mostrar.'}
        </p>
      ) : (
        <>
          <ul className="ca-admin-reviews__list">
            {items.map((item) => {
              const signals = activeReviewSignals(item.fraudFlags);
              return (
                <li key={item.id} className="ca-admin-reviews__row">
                  <div className="ca-admin-reviews__row-top">
                    <span
                      className="ca-admin-reviews__stars"
                      aria-label={`${item.rating} estrellas`}
                    >
                      {stars(item.rating)}
                    </span>
                    <span className="ca-admin-reviews__pair">
                      {ROLE_LABEL[item.reviewerRole] ?? item.reviewerRole} →{' '}
                      {ROLE_LABEL[item.revieweeRole] ?? item.revieweeRole}
                    </span>
                    {item.transactionCode ? (
                      <Link
                        to={`/operaciones/${item.transactionCode}`}
                        className="ca-admin-reviews__code"
                      >
                        {item.transactionCode}
                      </Link>
                    ) : null}
                    <span className="ca-admin-reviews__date">
                      {formatDateTime(item.createdAt)}
                    </span>
                  </div>

                  <div className="ca-admin-reviews__badges">
                    <TipBadge
                      id={`${item.id}-weight`}
                      label={`peso ${item.weight.toFixed(2)}`}
                      tip="Cuánto influye esta reseña en el promedio de reputación (0 = no suma; 1 = normal; hasta 1,2 si la operación es de monto alto)."
                      bg={item.weight < 1 ? 'warning' : 'secondary'}
                      text={item.weight < 1 ? 'dark' : undefined}
                    />
                    {signals.map((flag) => {
                      const meta = reviewSignalMeta(flag);
                      return (
                        <TipBadge
                          key={flag}
                          id={`${item.id}-${flag}`}
                          label={meta.label}
                          tip={meta.tip}
                          bg="warning"
                          text="dark"
                        />
                      );
                    })}
                    {item.visibility !== 'PUBLIC' ? (
                      <TipBadge
                        id={`${item.id}-vis`}
                        label={
                          item.visibility === 'PENDING_MODERATION'
                            ? 'En moderación'
                            : item.visibility
                        }
                        tip="Visibilidad de la reseña en la plataforma."
                        bg="dark"
                      />
                    ) : null}
                  </div>

                  {item.comment ? (
                    <p className="ca-admin-reviews__comment">{item.comment}</p>
                  ) : (
                    <p className="ca-admin-reviews__comment ca-admin-reviews__comment--muted">
                      Sin comentario
                    </p>
                  )}
                </li>
              );
            })}
          </ul>

          {totalPages > 1 ? (
            <nav className="ca-admin-reviews__pager" aria-label="Paginación de reseñas">
              <Button
                type="button"
                variant="outline-secondary"
                size="sm"
                disabled={page <= 1 || reviewsQuery.isFetching}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft size={16} aria-hidden />
                Anterior
              </Button>
              <span className="ca-admin-reviews__pager-status">
                Página {page} de {totalPages}
                <span className="ca-admin-reviews__meta"> · {total} registros</span>
              </span>
              <Button
                type="button"
                variant="outline-secondary"
                size="sm"
                disabled={page >= totalPages || reviewsQuery.isFetching}
                onClick={() => setPage((p) => p + 1)}
              >
                Siguiente
                <ChevronRight size={16} aria-hidden />
              </Button>
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}
