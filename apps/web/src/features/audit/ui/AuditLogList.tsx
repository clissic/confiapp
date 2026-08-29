import { Alert, Badge, Spinner } from 'react-bootstrap';
import { Copy } from 'lucide-react';

import { formatOperationMoney } from '@/shared/lib/money';
import { useAppToast } from '@/shared/ui';

import {
  labelAuditAction,
  labelAuditEntity,
  labelAuditOutcome,
} from '../model/labels';
import type { AuditLogItem } from '../model/types';
import { AuditPager } from './AuditPager';

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
        const diff = `${change.from} → ${change.to}`;
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
    bits.push(`${meta.from} → ${meta.to}`);
  } else if (typeof meta.to === 'string') {
    bits.push(`→ ${meta.to}`);
  }

  if (typeof meta.phase === 'string') {
    const phaseLabels: Record<string, string> = {
      manual_prex_receipt: 'Comprobante Prex recibido',
      manual_prex_admin_confirmed: 'Prex confirmado por admin',
      manual_prex_admin_unconfirmed: 'Prex desconfirmado por admin',
      confirm_hold: 'Pago confirmado en resguardo',
      release: 'Fondos liberados',
      refund: 'Reembolso',
    };
    bits.push(phaseLabels[meta.phase] ?? String(meta.phase));
  }
  if (typeof meta.reason === 'string') bits.push(String(meta.reason));
  if (typeof meta.kycDecision === 'string') bits.push(`KYC ${meta.kycDecision}`);
  if (typeof meta.provider === 'string' && meta.provider === 'MANUAL_PREX') {
    bits.push('Transferencia Prex');
  }
  if (typeof meta.receiptFileName === 'string' && meta.receiptFileName.trim()) {
    bits.push(meta.receiptFileName.trim());
  }
  if (typeof meta.amountCents === 'number') {
    const currency = typeof meta.currency === 'string' ? meta.currency : 'UYU';
    bits.push(formatOperationMoney(meta.amountCents, currency));
  }
  if (typeof meta.source === 'string') bits.push(String(meta.source));
  return bits.join(' · ');
}

type AuditLogListProps = {
  items: AuditLogItem[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  isFetching: boolean;
  total: number;
  totalPages: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  emptyMessage?: string;
};

/** Listado paginado de eventos de auditoría. */
export function AuditLogList({
  items,
  isLoading,
  isError,
  error,
  isFetching,
  total,
  totalPages,
  currentPage,
  onPageChange,
  emptyMessage = 'Todavía no hay eventos registrados en esta categoría.',
}: AuditLogListProps) {
  const toast = useAppToast();

  const copyUserId = async (userId: string) => {
    try {
      await navigator.clipboard.writeText(userId);
      toast.success('El ID del usuario fue copiado al portapapeles.');
    } catch {
      /* clipboard no disponible */
    }
  };

  if (isError) {
    return (
      <Alert variant="danger">
        {error instanceof Error ? error.message : 'Error al cargar los eventos'}
      </Alert>
    );
  }

  return (
    <section className="ca-audit-panel">
      {isLoading ? (
        <div className="d-flex align-items-center gap-2">
          <Spinner animation="border" size="sm" />
          <span className="ca-audit__hint">Cargando eventos…</span>
        </div>
      ) : items.length === 0 ? (
        <p className="ca-audit__hint">{emptyMessage}</p>
      ) : (
        <>
          <ul className="ca-audit-list">
            {items.map((item) => {
              const summary = summarize(item);
              const label = item.userEmail ?? item.entityId;
              return (
                <li key={item.id} className="ca-audit-item">
                  <div className="ca-audit-item__row">
                    <span className="ca-audit-item__action">
                      {labelAuditAction(item.action)}
                    </span>
                    <Badge bg="light" text="dark">
                      {labelAuditEntity(item.entityType)}
                    </Badge>
                    {item.outcome === 'SUCCESS' ? (
                      <span className="ca-audit-badge ca-audit-badge--ok">
                        {labelAuditOutcome(item.outcome)}
                      </span>
                    ) : null}
                    {item.outcome === 'FAILURE' ? (
                      <span className="ca-audit-badge ca-audit-badge--fail">
                        {labelAuditOutcome(item.outcome)}
                      </span>
                    ) : null}
                    <span className="ca-audit-item__meta ms-auto">
                      {formatWhen(item.createdAt)}
                    </span>
                  </div>
                  <div className="ca-audit-item__meta">
                    <span className="ca-audit-item__user">
                      <span
                        className={
                          item.userEmail ? 'ca-audit-item__email' : 'ca-audit-item__code'
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

          <AuditPager
            total={total}
            totalPages={totalPages}
            currentPage={currentPage}
            isFetching={isFetching}
            onPageChange={onPageChange}
          />
        </>
      )}
    </section>
  );
}
