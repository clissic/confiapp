import { FormEvent, useMemo, useState } from 'react';
import { Accordion, Badge, Button, Form } from 'react-bootstrap';
import { ChevronLeft, ChevronRight, Filter, History } from 'lucide-react';

import { formatDateTime } from '@/shared/lib/money';

import type { ProfileHistoryItem, UserProfile } from '../../model/types';

const PAGE_SIZE = 5;

const TYPE_VARIANT: Record<ProfileHistoryItem['type'], string> = {
  COMPLETED: 'success',
  CANCELLED: 'secondary',
  DISPUTED: 'danger',
  REVIEW: 'info',
  PAYMENT: 'primary',
};

const TYPE_LABELS: Record<ProfileHistoryItem['type'], string> = {
  COMPLETED: 'Completada',
  CANCELLED: 'Cancelada',
  DISPUTED: 'En disputa',
  REVIEW: 'Calificación',
  PAYMENT: 'Pago',
};

const TYPE_OPTIONS = Object.entries(TYPE_LABELS) as Array<
  [ProfileHistoryItem['type'], string]
>;

type HistoryFilters = {
  type: '' | ProfileHistoryItem['type'];
  from: string;
  to: string;
};

const EMPTY_FILTERS: HistoryFilters = {
  type: '',
  from: '',
  to: '',
};

function toStartMs(date: string): number {
  return new Date(`${date}T00:00:00`).getTime();
}

function toEndMs(date: string): number {
  return new Date(`${date}T23:59:59.999`).getTime();
}

function countActiveFilters(filters: HistoryFilters): number {
  return [filters.type, filters.from, filters.to].filter(Boolean).length;
}

function filterHistory(
  items: ProfileHistoryItem[],
  filters: HistoryFilters,
): ProfileHistoryItem[] {
  const fromMs = filters.from ? toStartMs(filters.from) : null;
  const toMs = filters.to ? toEndMs(filters.to) : null;

  return items.filter((item) => {
    if (filters.type && item.type !== filters.type) return false;
    const occurredMs = new Date(item.occurredAt).getTime();
    if (Number.isNaN(occurredMs)) return true;
    if (fromMs !== null && occurredMs < fromMs) return false;
    if (toMs !== null && occurredMs > toMs) return false;
    return true;
  });
}

export function HistorySection({ profile }: { profile: UserProfile }) {
  const [page, setPage] = useState(1);
  const [draftFilters, setDraftFilters] = useState<HistoryFilters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<HistoryFilters>(EMPTY_FILTERS);

  const activeFilterCount = countActiveFilters(appliedFilters);
  const hasAnyHistory = profile.history.length > 0;

  const filtered = useMemo(
    () => filterHistory(profile.history, appliedFilters),
    [profile.history, appliedFilters],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const applyFilters = (event: FormEvent) => {
    event.preventDefault();
    setAppliedFilters(draftFilters);
    setPage(1);
  };

  const clearFilters = () => {
    setDraftFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
    setPage(1);
  };

  return (
    <section>
      <h3 className="ca-section-title">Historial</h3>
      <p className="ca-section-lead">
        Actividad reciente: operaciones, pagos y calificaciones.
      </p>

      <div className="ca-stat-row mb-4">
        <div className="ca-stat">
          <span className="ca-stat__label">Completadas</span>
          <strong>{profile.stats.completedTransactions}</strong>
        </div>
        <div className="ca-stat">
          <span className="ca-stat__label">Canceladas</span>
          <strong>{profile.stats.cancelledTransactions}</strong>
        </div>
        <div className="ca-stat">
          <span className="ca-stat__label">Disputas</span>
          <strong>{profile.stats.disputedTransactions}</strong>
        </div>
        <div className="ca-stat">
          <span className="ca-stat__label">Éxito</span>
          <strong>{profile.stats.successRate}%</strong>
        </div>
      </div>

      {!hasAnyHistory ? (
        <div className="ca-empty">
          <History size={22} />
          <p className="mb-0">Todavía no hay actividad para mostrar.</p>
        </div>
      ) : (
        <>
          <Accordion className="ca-profile-history-filters mb-3">
            <Accordion.Item eventKey="0">
              <Accordion.Header>
                <span className="ca-profile-history-filters__header">
                  <Filter size={15} strokeWidth={1.75} aria-hidden />
                  Filtros
                  {activeFilterCount > 0 ? (
                    <Badge
                      bg="secondary"
                      pill
                      className="ca-profile-history-filters__count"
                    >
                      {activeFilterCount}
                    </Badge>
                  ) : null}
                </span>
              </Accordion.Header>
              <Accordion.Body>
                <Form
                  onSubmit={applyFilters}
                  className="ca-profile-history-filters__form"
                >
                  <Form.Group controlId="profile-history-filter-type">
                    <Form.Label>Tipo</Form.Label>
                    <Form.Select
                      value={draftFilters.type}
                      onChange={(e) =>
                        setDraftFilters((prev) => ({
                          ...prev,
                          type: e.target.value as HistoryFilters['type'],
                        }))
                      }
                    >
                      <option value="">Todos</option>
                      {TYPE_OPTIONS.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                  <Form.Group controlId="profile-history-filter-from">
                    <Form.Label>Desde</Form.Label>
                    <Form.Control
                      type="date"
                      value={draftFilters.from}
                      onChange={(e) =>
                        setDraftFilters((prev) => ({
                          ...prev,
                          from: e.target.value,
                        }))
                      }
                    />
                  </Form.Group>
                  <Form.Group controlId="profile-history-filter-to">
                    <Form.Label>Hasta</Form.Label>
                    <Form.Control
                      type="date"
                      value={draftFilters.to}
                      onChange={(e) =>
                        setDraftFilters((prev) => ({
                          ...prev,
                          to: e.target.value,
                        }))
                      }
                    />
                  </Form.Group>
                  <div className="ca-profile-history-filters__actions">
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

          {filtered.length === 0 ? (
            <div className="ca-empty">
              <Filter size={22} />
              <p className="mb-0">
                No hay actividad que coincida con los filtros.
              </p>
            </div>
          ) : (
            <>
              <ul className="ca-timeline">
                {pageItems.map((item) => (
                  <li key={item.id} className="ca-timeline__item">
                    <div className="ca-timeline__top">
                      <Badge bg={TYPE_VARIANT[item.type] ?? 'secondary'}>
                        {TYPE_LABELS[item.type] ?? item.type}
                      </Badge>
                      <time dateTime={item.occurredAt}>
                        {formatDateTime(item.occurredAt)}
                      </time>
                    </div>
                    <p className="ca-timeline__title">{item.title}</p>
                    {item.meta ? (
                      <p className="ca-timeline__meta">{item.meta}</p>
                    ) : null}
                  </li>
                ))}
              </ul>

              {totalPages > 1 ? (
                <nav
                  className="ca-profile-history__pager"
                  aria-label="Paginación del historial"
                >
                  <Button
                    type="button"
                    variant="outline-secondary"
                    size="sm"
                    disabled={currentPage <= 1}
                    onClick={() => setPage(Math.max(1, currentPage - 1))}
                  >
                    <ChevronLeft size={16} aria-hidden />
                    Anterior
                  </Button>
                  <span className="ca-profile-history__pager-status">
                    Página {currentPage} de {totalPages}
                    <span className="ca-profile-history__pager-hint">
                      {' '}
                      · {filtered.length}{' '}
                      {filtered.length === 1 ? 'registro' : 'registros'}
                    </span>
                  </span>
                  <Button
                    type="button"
                    variant="outline-secondary"
                    size="sm"
                    disabled={currentPage >= totalPages}
                    onClick={() => setPage(currentPage + 1)}
                  >
                    Siguiente
                    <ChevronRight size={16} aria-hidden />
                  </Button>
                </nav>
              ) : (
                <p className="ca-profile-history__pager-status ca-profile-history__pager-status--solo">
                  {filtered.length}{' '}
                  {filtered.length === 1 ? 'registro' : 'registros'}
                </p>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
