import { useMemo, useState } from 'react';
import { Alert, Badge, Form, Spinner } from 'react-bootstrap';
import { ScrollText } from 'lucide-react';

import { useMyAuditLogs } from '../hooks/useAudit';
import type { AuditLogItem } from '../model/types';
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
  if (typeof meta.from === 'string' && typeof meta.to === 'string') {
    bits.push(`${meta.from} → ${meta.to}`);
  } else if (typeof meta.to === 'string') {
    bits.push(`→ ${meta.to}`);
  }
  if (typeof meta.phase === 'string') bits.push(String(meta.phase));
  if (typeof meta.note === 'string') bits.push(String(meta.note));
  if (typeof meta.reason === 'string') bits.push(String(meta.reason));
  if (typeof meta.amountCents === 'number') {
    bits.push(`${(meta.amountCents / 100).toFixed(2)}`);
  }
  if (typeof meta.source === 'string') bits.push(String(meta.source));
  return bits.join(' · ');
}

/** Consulta de auditoría personal (append-only). */
export function AuditPage() {
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const params = useMemo(
    () => ({
      action: action || undefined,
      entityType: entityType || undefined,
      limit: 80,
    }),
    [action, entityType],
  );
  const { data, isLoading, isError, error, refetch, isFetching } = useMyAuditLogs(params);

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
        ) : !data?.length ? (
          <p className="ca-audit__hint">Todavía no hay eventos de auditoría para tu cuenta.</p>
        ) : (
          <ul className="ca-audit-list">
            {data.map((item) => {
              const summary = summarize(item);
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
                    <span className="ca-audit-item__code">{item.entityId}</span>
                    {item.correlationId ? (
                      <>
                        {' · '}
                        <span className="ca-audit-item__code">{item.correlationId}</span>
                      </>
                    ) : null}
                    {summary ? <> · {summary}</> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
