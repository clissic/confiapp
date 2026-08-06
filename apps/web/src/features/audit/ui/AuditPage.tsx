import { useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Form, Spinner } from 'react-bootstrap';
import { ChevronLeft, ChevronRight, Copy, ScrollText } from 'lucide-react';

import { useMyAuditLogs } from '../hooks/useAudit';
import { AUDIT_PAGE_SIZE, type AuditLogItem } from '../model/types';
import { formatMoney } from '@/shared/lib/money';
import { usePreferencesSnapshot } from '@/shared/preferences';
import { useAppToast } from '@/shared/ui';
import '../styles/audit.css';

const ACTION_OPTIONS = [
  '',
  'LOGIN',
  'LOGOUT',
  'LOGIN_FAILED',
  'REGISTER',
  'CREATE',
  'UPDATE',
  'STATUS_CHANGE',
  'PARTICIPANT_ADDED',
  'PAYMENT_CREATED',
  'PAYMENT_UPDATED',
  'WALLET_WITHDRAWAL',
  'AGENT_OFFERED',
  'AGENT_ACCEPTED',
  'AGENT_REJECTED',
  'AGENT_REASSIGNED',
  'ROLE_CHANGED',
  'MESSAGE_SENT',
  'CHAT_CREATED',
  'PASSWORD_CHANGE',
  'PASSWORD_RESET',
  'EMAIL_VERIFIED',
] as const;

const ENTITY_OPTIONS = [
  '',
  'User',
  'Transaction',
  'Payment',
  'Withdrawal',
  'Chat',
  'Message',
  'Notification',
] as const;

function formatWhen(iso: string): string {
  try {
    return new Intl.DateTimeFormat('es-UY', {
      dateStyle: 'short',
      timeStyle: 'medium',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function summarize(item: AuditLogItem): string {
  const meta = item.metadata ?? {};
  const bits: string[] = [];

  if (typeof meta.note === 'string' && meta.note.trim()) {
    bits.push(meta.note.trim());
  }

  if (typeof meta.summary === 'string' && meta.summary.trim()) {
    bits.push(meta.summary.trim());
  } else if (Array.isArray(meta.changes) && meta.changes.length > 0) {
    const parts = meta.changes
      .map((entry) => {
        if (!entry || typeof entry !== 'object') return null;
        const change = entry as { field?: unknown; from?: unknown; to?: unknown };
        if (typeof change.from !== 'string' || typeof change.to !== 'string') return null;
        const diff = `${change.from} > ${change.to}`;
        if (typeof change.field === 'string' && change.field.length > 0) {
          const bare = ['fullName', 'displayName', 'phone', 'documentNumber', 'role'].includes(
            change.field,
          );
          return bare ? diff : `${change.field}: ${diff}`;
        }
        return diff;
      })
      .filter((part): part is string => Boolean(part));
    if (parts.length) bits.push(parts.join(' · '));
  } else if (typeof meta.from === 'string' && typeof meta.to === 'string') {
    bits.push(`${meta.from} > ${meta.to}`);
  } else if (typeof meta.to === 'string') {
    bits.push(`→ ${meta.to}`);
  }

  if (typeof meta.phase === 'string') bits.push(String(meta.phase));
  if (typeof meta.reason === 'string') bits.push(String(meta.reason));
  if (typeof meta.kycDecision === 'string') bits.push(`KYC ${meta.kycDecision}`);
  if (typeof meta.amountCents === 'number') {
    const currency = typeof meta.currency === 'string' ? meta.currency : 'USD';
    bits.push(formatMoney(meta.amountCents, currency));
  }
  if (typeof meta.source === 'string') bits.push(String(meta.source));
  return bits.join(' · ');
}

/** Consulta de auditoría personal (append-only). */
export function AuditPage() {
  usePreferencesSnapshot();
  const toast = useAppToast();
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [action, entityType]);

  const params = useMemo(
    () => ({
      action: action || undefined,
      entityType: entityType || undefined,
      limit: AUDIT_PAGE_SIZE,
      page,
    }),
    [action, entityType, page],
  );
  const { data, isLoading, isError, error, refetch, isFetching } = useMyAuditLogs(params);

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 0;
  const currentPage = data?.page ?? page;

  const copyUserId = async (userId: string) => {
    try {
      await navigator.clipboard.writeText(userId);
      toast.success('El ID del usuario fue copiado al portapapeles.');
    } catch {
      /* clipboard no disponible */
    }
  };

  return (
    <div className="ca-audit">
      <header className="ca-audit__header">
        <div>
          <p className="ca-audit__kicker">Forense</p>
          <h2 className="ca-audit__title">
            <ScrollText size={28} className="me-2" aria-hidden />
            Auditoría
          </h2>
          <p className="ca-audit__lead">
            Registro append-only de logins, cambios de estado, pagos, wallet y actividad crítica
            asociada a tu cuenta.
          </p>
        </div>
        <Form className="ca-audit__filters" onSubmit={(e) => e.preventDefault()}>
          <label>
            Acción
            <Form.Select
              size="sm"
              value={action}
              onChange={(e) => setAction(e.target.value)}
              aria-label="Filtrar por acción"
            >
              {ACTION_OPTIONS.map((opt) => (
                <option key={opt || 'all'} value={opt}>
                  {opt || 'Todas'}
                </option>
              ))}
            </Form.Select>
          </label>
          <label>
            Entidad
            <Form.Select
              size="sm"
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
              aria-label="Filtrar por entidad"
            >
              {ENTITY_OPTIONS.map((opt) => (
                <option key={opt || 'all'} value={opt}>
                  {opt || 'Todas'}
                </option>
              ))}
            </Form.Select>
          </label>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={() => void refetch()}
            disabled={isFetching}
          >
            Actualizar
          </button>
        </Form>
      </header>

      {isError ? (
        <Alert variant="danger">{error instanceof Error ? error.message : 'Error al cargar'}</Alert>
      ) : null}

      <section className="ca-audit-panel">
        {isLoading ? (
          <div className="d-flex align-items-center gap-2">
            <Spinner animation="border" size="sm" />
            <span className="ca-audit__hint">Cargando eventos…</span>
          </div>
        ) : items.length === 0 ? (
          <p className="ca-audit__hint">Todavía no hay eventos de auditoría para tu cuenta.</p>
        ) : (
          <>
            <ul className="ca-audit-list">
              {items.map((item) => {
                const summary = summarize(item);
                const label = item.userEmail ?? item.entityId;
                return (
                  <li key={item.id} className="ca-audit-item">
                    <div className="ca-audit-item__row">
                      <span className="ca-audit-item__action">{item.action}</span>
                      <Badge bg="light" text="dark">
                        {item.entityType}
                      </Badge>
                      {item.outcome === 'SUCCESS' ? (
                        <span className="ca-audit-badge ca-audit-badge--ok">SUCCESS</span>
                      ) : null}
                      {item.outcome === 'FAILURE' ? (
                        <span className="ca-audit-badge ca-audit-badge--fail">FAILURE</span>
                      ) : null}
                      <span className="ca-audit-item__meta ms-auto">
                        {formatWhen(item.createdAt)}
                      </span>
                    </div>
                    <div className="ca-audit-item__meta">
                      <span className="ca-audit-item__user">
                        <span
                          className={
                            item.userEmail
                              ? 'ca-audit-item__email'
                              : 'ca-audit-item__code'
                          }
                        >
                          {label}
                        </span>
                        {item.userId ? (
                          <button
                            type="button"
                            className="ca-audit-item__copy"
                            aria-label="Copiar ID del usuario"
                            title="Copiar ID del usuario"
                            onClick={() => void copyUserId(item.userId!)}
                          >
                            <Copy size={14} strokeWidth={1.75} aria-hidden />
                          </button>
                        ) : null}
                      </span>
                      {item.correlationId ? (
                        <>
                          {' · '}
                          <span className="ca-audit-item__code">{item.correlationId}</span>
                        </>
                      ) : null}
                      {summary ? (
                        <>
                          {' · '}
                          <span className="ca-audit-item__change">{summary}</span>
                        </>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>

            {totalPages > 1 ? (
              <nav className="ca-audit__pager" aria-label="Paginación de auditoría">
                <Button
                  type="button"
                  variant="outline-secondary"
                  size="sm"
                  className="ca-audit__pager-btn"
                  disabled={currentPage <= 1 || isFetching}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  aria-label="Anterior"
                >
                  <ChevronLeft size={16} aria-hidden />
                  <span className="ca-audit__pager-label">Anterior</span>
                </Button>
                <span className="ca-audit__pager-status">
                  Página {currentPage} de {totalPages}
                  <span className="ca-audit__pager-total"> · {total} eventos</span>
                </span>
                <Button
                  type="button"
                  variant="outline-secondary"
                  size="sm"
                  className="ca-audit__pager-btn"
                  disabled={currentPage >= totalPages || isFetching}
                  onClick={() => setPage((p) => p + 1)}
                  aria-label="Siguiente"
                >
                  <span className="ca-audit__pager-label">Siguiente</span>
                  <ChevronRight size={16} aria-hidden />
                </Button>
              </nav>
            ) : total > 0 ? (
              <p className="ca-audit__pager-status ca-audit__pager-status--solo">
                {total} {total === 1 ? 'evento' : 'eventos'}
              </p>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
