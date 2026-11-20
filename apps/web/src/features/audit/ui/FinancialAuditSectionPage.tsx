import { useEffect, useState } from 'react';
import { Accordion, Alert, Button, Form, Spinner } from 'react-bootstrap';
import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@/shared/api/client';
import { formatDateTime, formatOperationMoney } from '@/shared/lib/money';

import {
  describeFinancialAuditAction,
  labelFinancialAuditAction,
  labelFinancialStatus,
} from '../model/labels';
import { AUDIT_PAGE_SIZE } from '../model/types';
import { getAuditSection } from '../model/sections';
import { AuditPager } from './AuditPager';

type FinancialAuditItem = {
  _id: string;
  action: string;
  amountCents?: number;
  currency?: string;
  previousStatus?: string;
  newStatus?: string;
  agentId?: string;
  operationId?: string;
  paymentId?: string;
  commissionId?: string;
  payoutId?: string;
  payoutBatchId?: string;
  actorId?: string;
  actorRole?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

type FinancialAuditResponse = {
  items: FinancialAuditItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

async function fetchFinancialAudit(params: {
  operationId?: string;
  agentId?: string;
  page: number;
}) {
  const { data } = await apiClient.get<FinancialAuditResponse>('/finance/audit', {
    params: {
      operationId: params.operationId || undefined,
      agentId: params.agentId || undefined,
      limit: AUDIT_PAGE_SIZE,
      page: params.page,
    },
  });
  return data;
}

function truncateId(id: string): string {
  return `…${String(id).slice(-8)}`;
}

function summarizeFinancial(item: FinancialAuditItem): string {
  const bits: string[] = [];
  if (typeof item.amountCents === 'number') {
    bits.push(formatOperationMoney(item.amountCents, item.currency ?? 'UYU'));
  }
  if (item.previousStatus && item.newStatus) {
    bits.push(
      `${labelFinancialStatus(item.previousStatus)} → ${labelFinancialStatus(item.newStatus)}`,
    );
  }
  if (item.agentId) bits.push(`Agente ${truncateId(item.agentId)}`);
  if (item.operationId) bits.push(`Op. ${truncateId(item.operationId)}`);
  return bits.join(' · ');
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="ca-audit-detail__row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

/** Registros de auditoría financiera (comisiones, liquidaciones). */
export function FinancialAuditSectionPage() {
  const section = getAuditSection('finanzas')!;
  const [operationId, setOperationId] = useState('');
  const [agentId, setAgentId] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [operationId, agentId]);

  const query = useQuery({
    queryKey: ['finance', 'audit', operationId, agentId, page],
    queryFn: () =>
      fetchFinancialAudit({
        operationId: operationId.trim() || undefined,
        agentId: agentId.trim() || undefined,
        page,
      }),
  });

  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const totalPages = query.data?.totalPages ?? 0;
  const currentPage = query.data?.page ?? page;

  return (
    <div className="ca-audit-section">
      <header className="ca-audit-section__head">
        <div>
          <h2 className="ca-audit-section__title">{section.label}</h2>
          <p className="ca-audit-section__lead">{section.lead}</p>
        </div>
      </header>

      <Accordion className="ca-audit-filters" defaultActiveKey="">
        <Accordion.Item eventKey="filters" className="ca-audit-filters__item">
          <Accordion.Header>Filtros</Accordion.Header>
          <Accordion.Body>
            <Form
              className="ca-audit-filters__form"
              onSubmit={(e) => {
                e.preventDefault();
                void query.refetch();
              }}
            >
              <Form.Group>
                <Form.Label>ID de operación</Form.Label>
                <Form.Control
                  size="sm"
                  value={operationId}
                  onChange={(e) => setOperationId(e.target.value)}
                  placeholder="Opcional"
                />
              </Form.Group>
              <Form.Group>
                <Form.Label>ID de agente</Form.Label>
                <Form.Control
                  size="sm"
                  value={agentId}
                  onChange={(e) => setAgentId(e.target.value)}
                  placeholder="Opcional"
                />
              </Form.Group>
              <div className="ca-audit-filters__actions">
                <Button
                  type="button"
                  size="sm"
                  variant="outline-secondary"
                  onClick={() => void query.refetch()}
                  disabled={query.isFetching}
                >
                  Actualizar
                </Button>
                {operationId || agentId ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="link"
                    className="ca-audit-filters__clear"
                    onClick={() => {
                      setOperationId('');
                      setAgentId('');
                    }}
                  >
                    Limpiar filtros
                  </Button>
                ) : null}
              </div>
            </Form>
          </Accordion.Body>
        </Accordion.Item>
      </Accordion>

      <section className="ca-audit-panel">
        {query.isError ? (
          <Alert variant="danger">No se pudieron cargar los registros financieros.</Alert>
        ) : query.isLoading ? (
          <div className="d-flex align-items-center gap-2">
            <Spinner animation="border" size="sm" />
            <span className="ca-audit__hint">Cargando registros…</span>
          </div>
        ) : items.length === 0 ? (
          <p className="ca-audit__hint">
            Todavía no hay movimientos financieros registrados en auditoría.
          </p>
        ) : (
          <>
            <Accordion alwaysOpen className="ca-audit-events">
              {items.map((item) => {
                const summary = summarizeFinancial(item);
                const statusLabel = item.newStatus
                  ? labelFinancialStatus(item.newStatus)
                  : null;
                return (
                  <Accordion.Item
                    key={item._id}
                    eventKey={item._id}
                    className="ca-audit-events__item"
                  >
                    <Accordion.Header>
                      <div className="ca-audit-events__head">
                        <div className="ca-audit-item__row">
                          <span className="ca-audit-item__action">
                            {labelFinancialAuditAction(item.action)}
                          </span>
                          {statusLabel ? (
                            <span className="ca-audit-badge ca-audit-badge--ok">
                              {statusLabel}
                            </span>
                          ) : null}
                          <span className="ca-audit-item__meta ms-auto">
                            {formatDateTime(item.createdAt)}
                          </span>
                        </div>
                        {summary ? (
                          <div className="ca-audit-item__meta ca-audit-events__summary">
                            {summary}
                          </div>
                        ) : null}
                      </div>
                    </Accordion.Header>
                    <Accordion.Body>
                      <p className="ca-audit-detail__description">
                        {describeFinancialAuditAction(item.action)}
                      </p>
                      <dl className="ca-audit-detail">
                        <DetailRow
                          label="Acción"
                          value={labelFinancialAuditAction(item.action)}
                        />
                        <DetailRow label="Fecha" value={formatDateTime(item.createdAt)} />
                        {typeof item.amountCents === 'number' ? (
                          <DetailRow
                            label="Monto"
                            value={formatOperationMoney(
                              item.amountCents,
                              item.currency ?? 'UYU',
                            )}
                          />
                        ) : null}
                        {item.previousStatus || item.newStatus ? (
                          <DetailRow
                            label="Estado"
                            value={
                              item.previousStatus && item.newStatus
                                ? `${labelFinancialStatus(item.previousStatus)} → ${labelFinancialStatus(item.newStatus)}`
                                : labelFinancialStatus(
                                    item.newStatus ?? item.previousStatus ?? '',
                                  )
                            }
                          />
                        ) : null}
                        {item.operationId ? (
                          <DetailRow label="Operación" value={String(item.operationId)} />
                        ) : null}
                        {item.agentId ? (
                          <DetailRow label="Agente" value={String(item.agentId)} />
                        ) : null}
                        {item.paymentId ? (
                          <DetailRow label="Pago" value={String(item.paymentId)} />
                        ) : null}
                        {item.commissionId ? (
                          <DetailRow label="Comisión" value={String(item.commissionId)} />
                        ) : null}
                        {item.payoutId ? (
                          <DetailRow label="Pago a agente" value={String(item.payoutId)} />
                        ) : null}
                        {item.payoutBatchId ? (
                          <DetailRow
                            label="Lote de liquidación"
                            value={String(item.payoutBatchId)}
                          />
                        ) : null}
                        {item.actorId ? (
                          <DetailRow label="Actor" value={String(item.actorId)} />
                        ) : null}
                        {item.actorRole ? (
                          <DetailRow label="Rol del actor" value={item.actorRole} />
                        ) : null}
                        <DetailRow label="ID del evento" value={item._id} />
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
              isFetching={query.isFetching}
              onPageChange={setPage}
              itemLabel={{ one: 'registro', other: 'registros' }}
            />
          </>
        )}
      </section>
    </div>
  );
}
