import { Accordion, Alert, Badge, Spinner } from 'react-bootstrap';
import { Copy } from 'lucide-react';

import { formatOperationMoney } from '@/shared/lib/money';
import { useAppToast } from '@/shared/ui';

import {
  describeAuditAction,
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
      manual_prex_receipt: 'Comprobante de transferencia recibido',
      manual_prex_admin_confirmed: 'Transferencia confirmada por admin',
      manual_prex_admin_unconfirmed: 'Transferencia desconfirmada por admin',
      manual_prex_pending: 'Transferencia pendiente de verificación',
      confirm_hold: 'Servicio del Agente pagado',
      agent_fee_captured: 'Contratación del Agente cobrada',
      agent_fee_checkout_created: 'Checkout de contratación creado',
      agent_fee_only_released: 'Operación cerrada — comisión acreditada',
      hold_captured: 'Contratación cobrada',
      retention: 'Contratación en proceso',
      retained: 'Contratación retenida',
      checkout_created: 'Checkout creado',
      release: 'Operación cerrada — comisión acreditada',
      escrow_released: 'Operación cerrada — comisión acreditada',
      released: 'Operación cerrada — comisión acreditada',
      refund: 'Reembolso de la contratación',
      refunded: 'Reembolso de la contratación',
    };
    bits.push(phaseLabels[meta.phase] ?? String(meta.phase));
  }
  if (typeof meta.reason === 'string') bits.push(String(meta.reason));
  if (typeof meta.kycDecision === 'string') bits.push(`KYC ${meta.kycDecision}`);
  if (typeof meta.provider === 'string' && meta.provider === 'MANUAL_PREX') {
    bits.push('Transferencia manual');
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

function formatMetaValue(value: unknown): string {
  if (value == null) return '—';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

const META_FIELD_LABELS: Record<string, string> = {
  note: 'Nota',
  summary: 'Resumen',
  phase: 'Fase',
  reason: 'Motivo',
  source: 'Origen',
  amountCents: 'Monto (centavos)',
  currency: 'Moneda',
  provider: 'Proveedor',
  code: 'Código',
  from: 'Desde',
  to: 'Hasta',
  kycDecision: 'Decisión KYC',
  receiptFileName: 'Comprobante',
  changes: 'Cambios',
};

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="ca-audit-detail__row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
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
          <Accordion alwaysOpen className="ca-audit-events">
            {items.map((item) => {
              const summary = summarize(item);
              const label = item.userEmail ?? item.entityId;
              const meta = item.metadata ?? {};
              return (
                <Accordion.Item
                  key={item.id}
                  eventKey={item.id}
                  className="ca-audit-events__item"
                >
                  <Accordion.Header>
                    <div className="ca-audit-events__head">
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
                      <div className="ca-audit-item__meta ca-audit-events__summary">
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
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                void copyUserId(item.userId!);
                              }}
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
                    </div>
                  </Accordion.Header>
                  <Accordion.Body>
                    <p className="ca-audit-detail__description">
                      {describeAuditAction(item.action)}
                    </p>
                    <dl className="ca-audit-detail">
                      <DetailRow label="Acción" value={labelAuditAction(item.action)} />
                      <DetailRow
                        label="Entidad"
                        value={`${labelAuditEntity(item.entityType)} · ${item.entityId}`}
                      />
                      <DetailRow label="Fecha" value={formatWhen(item.createdAt)} />
                      {item.outcome ? (
                        <DetailRow
                          label="Resultado"
                          value={labelAuditOutcome(item.outcome)}
                        />
                      ) : null}
                      {item.userEmail ? (
                        <DetailRow label="Usuario" value={item.userEmail} />
                      ) : null}
                      {item.userId ? (
                        <DetailRow label="ID de usuario" value={item.userId} />
                      ) : null}
                      {item.actorId ? (
                        <DetailRow label="Actor" value={item.actorId} />
                      ) : null}
                      {item.actorRole ? (
                        <DetailRow label="Rol del actor" value={item.actorRole} />
                      ) : null}
                      {item.correlationId ? (
                        <DetailRow label="Correlación" value={item.correlationId} />
                      ) : null}
                      {item.ipAddress ? (
                        <DetailRow label="IP" value={item.ipAddress} />
                      ) : null}
                      {item.userAgent ? (
                        <DetailRow label="User agent" value={item.userAgent} />
                      ) : null}
                      <DetailRow label="ID del evento" value={item.id} />
                      {Object.entries(meta).map(([key, value]) => (
                        <DetailRow
                          key={key}
                          label={META_FIELD_LABELS[key] ?? key}
                          value={
                            key === 'amountCents' && typeof value === 'number'
                              ? formatOperationMoney(
                                  value,
                                  typeof meta.currency === 'string'
                                    ? meta.currency
                                    : 'UYU',
                                )
                              : formatMetaValue(value)
                          }
                        />
                      ))}
                    </dl>
                  </Accordion.Body>
                </Accordion.Item>
              );
            })}
          </Accordion>

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
