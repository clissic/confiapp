import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  Accordion,
  Alert,
  Badge,
  Button,
  Form,
  Spinner,
} from 'react-bootstrap';
import { ChevronLeft, ChevronRight, Filter, X } from 'lucide-react';

import {
  DISPUTE_CATEGORY_LABELS,
  DISPUTE_STATUS_LABELS,
  type DisputeStatus,
} from '@/features/disputes/api/disputes.api';
import { useDispute, useDisputes, useResolveDispute } from '@/features/disputes/hooks/useDisputes';
import { STATUS_LABELS, type TransactionStatus } from '@/features/transactions/model/types';
import { getApiErrorMessage } from '@/shared/api/client';
import { formatDateTime } from '@/shared/lib/money';
import { useAppToast } from '@/shared/ui';

import '../styles/admin-disputes.css';

const STATUS_TONE: Record<DisputeStatus, string> = {
  OPEN: 'open',
  UNDER_REVIEW: 'review',
  RESOLVED: 'ok',
  DISMISSED: 'muted',
  CLOSED: 'muted',
};

const STATUS_FILTER_OPTIONS: Array<{ value: DisputeStatus | ''; label: string }> = [
  { value: '', label: 'Todas' },
  { value: 'OPEN', label: 'Abiertas' },
  { value: 'UNDER_REVIEW', label: 'En revisión' },
  { value: 'RESOLVED', label: 'Resueltas' },
  { value: 'DISMISSED', label: 'Descartadas' },
  { value: 'CLOSED', label: 'Cerradas' },
];

/** Admin: listado y resolución de disputas. */
export function AdminDisputesPage() {
  const toast = useAppToast();
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  const [draftStatus, setDraftStatus] = useState<DisputeStatus | ''>('OPEN');
  const [appliedStatus, setAppliedStatus] = useState<DisputeStatus | ''>('OPEN');

  const listQuery = useDisputes(page, appliedStatus || undefined);
  const detailQuery = useDispute(selectedId);
  const resolveMutation = useResolveDispute(selectedId ?? '');

  const items = listQuery.data?.items ?? [];
  const total = listQuery.data?.total ?? 0;
  const totalPages = listQuery.data?.totalPages ?? 0;
  const currentPage = listQuery.data?.page ?? page;
  const detail = detailQuery.data;

  const activeFilterCount = appliedStatus ? 1 : 0;

  const canResolve = useMemo(
    () =>
      Boolean(
        detail &&
          detail.status !== 'RESOLVED' &&
          detail.status !== 'CLOSED' &&
          detail.status !== 'DISMISSED',
      ),
    [detail],
  );

  const applyFilters = (event: FormEvent) => {
    event.preventDefault();
    setAppliedStatus(draftStatus);
    setPage(1);
    setSelectedId(null);
    setNotes('');
  };

  const clearFilters = () => {
    setDraftStatus('');
    setAppliedStatus('');
    setPage(1);
    setSelectedId(null);
    setNotes('');
  };

  const handleResolve = (outcome: 'RESUME' | 'CANCEL' | 'COMPLETE_WITH_REFUND') => {
    if (!selectedId) return;
    resolveMutation.mutate(
      { outcome, notes: notes.trim() || undefined },
      {
        onSuccess: () => {
          const labels = {
            RESUME: 'Operación reanudada.',
            CANCEL: 'Operación cancelada.',
            COMPLETE_WITH_REFUND: 'Reembolso iniciado.',
          };
          toast.success(`Disputa resuelta. ${labels[outcome]}`);
          setSelectedId(null);
          setNotes('');
        },
        onError: (err) => {
          toast.error(getApiErrorMessage(err, 'No se pudo resolver la disputa.'));
        },
      },
    );
  };

  return (
    <div className="ca-admin-disputes">
      <header className="ca-admin-disputes__header">
        <p className="ca-admin-disputes__kicker">Administración</p>
        <h1 className="ca-admin-disputes__title">Disputas</h1>
        <p className="ca-admin-disputes__lead">
          Reportes del comprador sobre operaciones activas. Al resolver, elegí si reanudar, cancelar
          o reembolsar al comprador.
        </p>
      </header>

      {listQuery.isError ? (
        <Alert variant="danger" className="mb-0">
          No se pudieron cargar las disputas.
        </Alert>
      ) : null}

      <div className={`ca-admin-disputes__body${selectedId ? ' has-detail' : ''}`}>
        <section className="ca-admin-disputes__list-panel" aria-label="Listado de disputas">
          <div className="ca-admin-disputes__list-head">
            <h2 className="ca-admin-disputes__section-title">Historial</h2>
            <p className="ca-admin-disputes__meta-count">
              {total} disputa{total === 1 ? '' : 's'}
            </p>
          </div>

          <Accordion className="ca-admin-disputes-filters">
            <Accordion.Item eventKey="0">
              <Accordion.Header>
                <span className="ca-admin-disputes-filters__header">
                  <Filter size={15} strokeWidth={1.75} aria-hidden />
                  Filtros
                  {activeFilterCount > 0 ? (
                    <Badge bg="secondary" pill className="ca-admin-disputes-filters__count">
                      {activeFilterCount}
                    </Badge>
                  ) : null}
                </span>
              </Accordion.Header>
              <Accordion.Body>
                <Form onSubmit={applyFilters} className="ca-admin-disputes-filters__form">
                  <Form.Group controlId="admin-dispute-status">
                    <Form.Label>Estado</Form.Label>
                    <Form.Select
                      value={draftStatus}
                      onChange={(e) => setDraftStatus(e.target.value as DisputeStatus | '')}
                    >
                      {STATUS_FILTER_OPTIONS.map((opt) => (
                        <option key={opt.value || 'all'} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                  <div className="ca-admin-disputes-filters__actions">
                    <Button type="submit" size="sm" className="ca-btn-cta">
                      Aplicar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline-secondary"
                      onClick={clearFilters}
                      disabled={activeFilterCount === 0}
                    >
                      Limpiar
                    </Button>
                  </div>
                </Form>
              </Accordion.Body>
            </Accordion.Item>
          </Accordion>

          {listQuery.isLoading ? (
            <div className="ca-admin-disputes__quiet">
              <Spinner animation="border" size="sm" />
              <span>Cargando disputas…</span>
            </div>
          ) : items.length === 0 ? (
            <p className="ca-admin-disputes__empty">
              {activeFilterCount > 0
                ? 'No hay disputas con ese filtro.'
                : 'No hay disputas para mostrar.'}
            </p>
          ) : (
            <ul className="ca-admin-disputes__list">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`ca-admin-disputes__row${selectedId === item.id ? ' is-active' : ''}`}
                    onClick={() => {
                      setSelectedId(item.id);
                      setNotes('');
                    }}
                  >
                    <div className="ca-admin-disputes__row-main">
                      <span className="ca-admin-disputes__code">{item.transactionCode}</span>
                      <span
                        className={`ca-admin-disputes__status ca-admin-disputes__status--${STATUS_TONE[item.status] ?? 'muted'}`}
                      >
                        {DISPUTE_STATUS_LABELS[item.status] ?? item.status}
                      </span>
                    </div>
                    <p className="ca-admin-disputes__reason">{item.reason}</p>
                    <div className="ca-admin-disputes__meta">
                      {item.category ? (
                        <span>{DISPUTE_CATEGORY_LABELS[item.category]}</span>
                      ) : null}
                      <span>{formatDateTime(item.openedAt)}</span>
                      {item.openedByName ? <span>{item.openedByName}</span> : null}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {totalPages > 1 ? (
            <nav className="ca-admin-disputes__pager" aria-label="Paginación de disputas">
              <Button
                type="button"
                variant="outline-secondary"
                size="sm"
                disabled={currentPage <= 1 || listQuery.isFetching}
                onClick={() => {
                  setPage((p) => Math.max(1, p - 1));
                  setSelectedId(null);
                  setNotes('');
                }}
              >
                <ChevronLeft size={16} aria-hidden />
                Anterior
              </Button>
              <span className="ca-admin-disputes__pager-status">
                Página {currentPage} de {totalPages}
                <span className="ca-admin-disputes__meta-count"> · {total} registros</span>
              </span>
              <Button
                type="button"
                variant="outline-secondary"
                size="sm"
                disabled={currentPage >= totalPages || listQuery.isFetching}
                onClick={() => {
                  setPage((p) => p + 1);
                  setSelectedId(null);
                  setNotes('');
                }}
              >
                Siguiente
                <ChevronRight size={16} aria-hidden />
              </Button>
            </nav>
          ) : null}
        </section>

        {selectedId ? (
          <aside className="ca-admin-disputes__detail" aria-label="Detalle de disputa">
            {detailQuery.isLoading ? (
              <div className="ca-admin-disputes__quiet">
                <Spinner animation="border" size="sm" />
                <span>Cargando detalle…</span>
              </div>
            ) : detail ? (
              <>
                <div className="ca-admin-disputes__detail-head">
                  <div className="ca-admin-disputes__detail-intro">
                    <p className="ca-admin-disputes__detail-kicker">Operación</p>
                    <h2 className="ca-admin-disputes__detail-code">{detail.transaction.code}</h2>
                    <p className="ca-admin-disputes__detail-title">{detail.transaction.title}</p>
                  </div>
                  <button
                    type="button"
                    className="ca-admin-disputes__close"
                    aria-label="Cerrar detalle"
                    onClick={() => setSelectedId(null)}
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="ca-admin-disputes__summary">
                  <div className="ca-admin-disputes__stat">
                    <span className="ca-admin-disputes__stat-label">Estado disputa</span>
                    <span
                      className={`ca-admin-disputes__status ca-admin-disputes__status--${STATUS_TONE[detail.status] ?? 'muted'}`}
                    >
                      {DISPUTE_STATUS_LABELS[detail.status]}
                    </span>
                  </div>
                  <div className="ca-admin-disputes__stat">
                    <span className="ca-admin-disputes__stat-label">Operación</span>
                    <span className="ca-admin-disputes__stat-value">
                      {STATUS_LABELS[detail.transaction.status as TransactionStatus] ??
                        detail.transaction.status}
                    </span>
                  </div>
                  <div className="ca-admin-disputes__stat">
                    <span className="ca-admin-disputes__stat-label">Categoría</span>
                    <span className="ca-admin-disputes__stat-value">
                      {detail.category
                        ? DISPUTE_CATEGORY_LABELS[detail.category]
                        : 'Sin categoría'}
                    </span>
                  </div>
                  <div className="ca-admin-disputes__stat">
                    <span className="ca-admin-disputes__stat-label">Fecha</span>
                    <span className="ca-admin-disputes__stat-value">
                      {formatDateTime(detail.openedAt)}
                    </span>
                  </div>
                </div>

                <dl className="ca-admin-disputes__facts">
                  <div className="ca-admin-disputes__facts-wide">
                    <dt>Abierta por</dt>
                    <dd>
                      {detail.openedBy.displayName ?? 'Comprador'}
                      {detail.openedBy.email ? (
                        <span className="ca-admin-disputes__sub">{detail.openedBy.email}</span>
                      ) : null}
                    </dd>
                  </div>
                  <div className="ca-admin-disputes__facts-wide">
                    <dt>Motivo</dt>
                    <dd>{detail.reason}</dd>
                  </div>
                  {detail.resolutionNote ? (
                    <div className="ca-admin-disputes__facts-wide">
                      <dt>Notas de resolución</dt>
                      <dd>{detail.resolutionNote}</dd>
                    </div>
                  ) : null}
                </dl>

                <p className="ca-admin-disputes__op-link">
                  <Link to={`/operaciones/${detail.transaction.code}`}>Ver operación completa</Link>
                </p>

                {canResolve ? (
                  <div className="ca-admin-disputes__resolve">
                    <h3 className="ca-admin-disputes__resolve-title">Resolver</h3>
                    <p className="ca-admin-disputes__resolve-lead">
                      Elegí el resultado según la evidencia. La nota queda en el historial interno.
                    </p>
                    <Form.Group className="ca-admin-disputes__notes">
                      <Form.Label>Notas internas (opcional)</Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={3}
                        maxLength={1000}
                        value={notes}
                        disabled={resolveMutation.isPending}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Comentario para el historial de la disputa."
                      />
                    </Form.Group>
                    <div className="ca-admin-disputes__actions">
                      <Button
                        variant="outline-secondary"
                        disabled={resolveMutation.isPending}
                        onClick={() => handleResolve('RESUME')}
                      >
                        Reanudar operación
                      </Button>
                      <Button
                        variant="outline-danger"
                        disabled={resolveMutation.isPending}
                        onClick={() => handleResolve('CANCEL')}
                      >
                        Cancelar operación
                      </Button>
                      <Button
                        className="ca-btn-cta"
                        disabled={resolveMutation.isPending}
                        onClick={() => handleResolve('COMPLETE_WITH_REFUND')}
                      >
                        {resolveMutation.isPending ? 'Procesando…' : 'Reembolsar comprador'}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <Alert variant="warning" className="mb-0">
                No se encontró el detalle de esta disputa.
              </Alert>
            )}
          </aside>
        ) : null}
      </div>
    </div>
  );
}
