import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Alert, Badge, Button, Form, Spinner, Table } from 'react-bootstrap';

import { formatDateTime, formatMoney } from '@/shared/lib/money';
import { usePreferencesSnapshot } from '@/shared/preferences';
import { useAppToast } from '@/shared/ui';

import {
  useEscrow,
  useMyPayments,
  usePaymentLogs,
  useReleaseEscrow,
  useStartCheckout,
} from '../hooks/usePayments';
import '../styles/payments.css';

export function PaymentsPage() {
  usePreferencesSnapshot();
  const toast = useAppToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCode = searchParams.get('code') ?? 'DEMO-001';
  const [code, setCode] = useState(initialCode);
  const [lookup, setLookup] = useState(initialCode);
  const [error, setError] = useState<string | null>(null);

  const { data: paymentsData } = useMyPayments();
  const { data: escrowData, isFetching } = useEscrow(lookup);
  const { data: logsData } = usePaymentLogs();
  const checkout = useStartCheckout(lookup);
  const release = useReleaseEscrow(lookup);

  const escrow = escrowData?.data;
  const statusParam = searchParams.get('status');

  useEffect(() => {
    if (statusParam === 'success') {
      toast.success('Pago confirmado / retención actualizada.');
    } else if (statusParam === 'failure') {
      setError('El pago falló o fue cancelado en Mercado Pago.');
    }
  }, [statusParam, toast]);

  const onLookup = (event: FormEvent) => {
    event.preventDefault();
    const next = code.trim().toUpperCase();
    setLookup(next);
    setSearchParams({ code: next });
    setError(null);
  };

  const onCheckout = async () => {
    setError(null);
    try {
      const result = await checkout.mutateAsync();
      toast.success(
        `Checkout listo (${result.providerMode}). Split: plataforma ${formatMoney(result.split.platformFeeCents)} · agente ${formatMoney(result.split.agentFeeCents)} · vendedor ${formatMoney(result.split.sellerCents)}`,
      );
      if (result.checkoutUrl && result.checkoutUrl !== '#') {
        window.location.href = result.checkoutUrl;
      }
    } catch {
      setError('No se pudo iniciar el checkout. ¿Sos el comprador y la op. está ACCEPTED?');
    }
  };

  const onRelease = async () => {
    setError(null);
    try {
      await release.mutateAsync();
      toast.success('Escrow liberado: neto al vendedor, 20% plataforma, pago al agente.');
    } catch {
      setError('No se pudo liberar. ¿La operación está FUNDED?');
    }
  };

  return (
    <div className="ca-payments">
      <header className="ca-payments__header">
        <div>
          <p className="ca-payments__kicker">Pagos · Mercado Pago Uruguay</p>
          <h2 className="ca-payments__title">Escrow</h2>
          <p className="ca-payments__lead">
            Monedas: UYU o USD. Pago del comprador, retención, webhook MLU, liberación con 20% de
            comisión y pago al agente.
          </p>
        </div>
        {escrow?.providerMode ? (
          <Badge bg="light" text="dark">
            {escrow.providerMode}
          </Badge>
        ) : null}
      </header>

      <section className="ca-payments-panel">
        <Form className="ca-payments__lookup" onSubmit={onLookup}>
          <Form.Group>
            <Form.Label>Código de operación</Form.Label>
            <Form.Control
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="DEMO-001"
            />
          </Form.Group>
          <Button type="submit" className="ca-btn-primary align-self-end">
            Ver escrow
          </Button>
        </Form>
      </section>

      {error ? <Alert variant="danger">{error}</Alert> : null}

      <section className="ca-payments-panel">
        <div className="ca-payments__row">
          <h3 className="mb-0">Operación {lookup}</h3>
          {isFetching ? <Spinner size="sm" animation="border" /> : null}
        </div>
        {escrow ? (
          <>
            <div className="ca-payments__meta">
              <span>
                Estado: <strong>{escrow.status}</strong>
              </span>
              <span>Bruto: {formatMoney(escrow.grossCents, escrow.currency)}</span>
            </div>
            <div className="ca-payments-split">
              <div>
                <span>Plataforma 20%</span>
                <strong>{formatMoney(escrow.split.platformFeeCents, escrow.currency)}</strong>
              </div>
              <div>
                <span>Agente {escrow.split.agentFeeBps / 100}%</span>
                <strong>{formatMoney(escrow.split.agentFeeCents, escrow.currency)}</strong>
              </div>
              <div>
                <span>Vendedor</span>
                <strong>{formatMoney(escrow.split.sellerCents, escrow.currency)}</strong>
              </div>
            </div>
            <div className="ca-form-actions">
              <Button
                className="ca-btn-cta"
                disabled={checkout.isPending}
                onClick={() => void onCheckout()}
              >
                {checkout.isPending ? 'Creando…' : 'Pagar (comprador)'}
              </Button>
              <Button
                variant="outline-secondary"
                disabled={release.isPending}
                onClick={() => void onRelease()}
              >
                {release.isPending ? 'Liberando…' : 'Liberar escrow'}
              </Button>
            </div>
            {escrow.payments.length > 0 ? (
              <Table responsive size="sm" className="mb-0 mt-3">
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th>Estado</th>
                    <th>Monto</th>
                    <th>Proveedor</th>
                  </tr>
                </thead>
                <tbody>
                  {escrow.payments.map((p) => (
                    <tr key={p.id}>
                      <td>{p.type}</td>
                      <td>{p.status}</td>
                      <td>{formatMoney(p.amountCents, p.currency)}</td>
                      <td>{p.provider}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <p className="ca-payments__hint">Sin movimientos aún.</p>
            )}
          </>
        ) : null}
      </section>

      <section className="ca-payments-panel">
        <h3>Mis pagos</h3>
        {(paymentsData?.items.length ?? 0) === 0 ? (
          <p className="ca-payments__hint">No hay pagos registrados para tu usuario.</p>
        ) : (
          <Table responsive size="sm" className="mb-0">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Estado</th>
                <th>Monto</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {paymentsData?.items.map((p) => (
                <tr key={p.id}>
                  <td>{p.type}</td>
                  <td>{p.status}</td>
                  <td>{formatMoney(p.amountCents, p.currency)}</td>
                  <td>{formatDateTime(p.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </section>

      <section className="ca-payments-panel">
        <h3>Logs</h3>
        <ul className="ca-payments-logs">
          {(logsData?.items ?? []).map((log) => (
            <li key={log.id}>
              <Badge bg={log.level === 'error' ? 'danger' : log.level === 'warn' ? 'warning' : 'secondary'}>
                {log.source}
              </Badge>{' '}
              <strong>{log.event}</strong> — {log.message}
              <div className="ca-payments__hint">
                {formatDateTime(log.createdAt)}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
