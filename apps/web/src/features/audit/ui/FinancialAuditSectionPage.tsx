import { useEffect, useState } from 'react';
import { Accordion, Alert, Button, Form, Spinner } from 'react-bootstrap';
import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@/shared/api/client';
import { formatDateTime, formatOperationMoney } from '@/shared/lib/money';

import { labelFinancialAuditAction } from '../model/labels';
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
  payoutId?: string;
  payoutBatchId?: string;
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
            <ul className="ca-audit-list">
              {items.map((item) => (
                <li key={item._id} className="ca-audit-item">
                  <div className="ca-audit-item__row">
                    <span className="ca-audit-item__action">
                      {labelFinancialAuditAction(item.action)}
                    </span>
                    {item.newStatus ? (
                      <span className="ca-audit-badge ca-audit-badge--ok">{item.newStatus}</span>
                    ) : null}
                    <span className="ca-audit-item__meta ms-auto">
                      {formatDateTime(item.createdAt)}
                    </span>
                  </div>
                  <div className="ca-audit-item__meta">
                    {typeof item.amountCents === 'number' ? (
                      <>
                        {formatOperationMoney(item.amountCents, item.currency ?? 'UYU')}
                        {' · '}
                      </>
                    ) : null}
                    {item.previousStatus && item.newStatus ? (
                      <>
                        {item.previousStatus} → {item.newStatus}
                        {' · '}
                      </>
                    ) : null}
                    {item.agentId ? (
                      <span className="ca-audit-item__code">
                        Agente …{String(item.agentId).slice(-8)}
                      </span>
                    ) : null}
                    {item.operationId ? (
                      <>
                        {' · '}
                        <span className="ca-audit-item__code">
                          Op. …{String(item.operationId).slice(-8)}
                        </span>
                      </>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>

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
