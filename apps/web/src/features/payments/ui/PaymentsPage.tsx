import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Alert, Button, Form, Spinner, Table } from 'react-bootstrap';
import { FEE_PAYER_LABELS, type FeePayer } from '@confiapp/shared';

import { formatDateTime, formatOperationMoney } from '@/shared/lib/money';
import { useAppToast } from '@/shared/ui';
import { STATUS_LABELS, type TransactionStatus } from '@/features/transactions/model/types';

import {
  useEscrow,
  useMyPayments,
  useReleaseEscrow,
  useStartCheckout,
} from '../hooks/usePayments';
import '../styles/payments.css';

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  ESCROW_HOLD: 'Contratación del Agente',
  ESCROW_RELEASE: 'Cierre — comisión acreditada',
  REFUND: 'Reembolso',
  PLATFORM_FEE: 'Comisión ConfiApp',
  AGENT_PAYOUT: 'Pago al agente',
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente',
  REQUIRES_ACTION: 'Pendiente de pago',
  AUTHORIZED: 'Autorizado',
  CAPTURED: 'Cobrado',
  RELEASED: 'Comisión acreditada',
  REFUNDED: 'Reembolsado',
  FAILED: 'Fallido',
  CANCELLED: 'Cancelado',
};

const PROVIDER_LABELS: Record<string, string> = {
  MOCK: 'Prueba',
  MERCADOPAGO: 'Mercado Pago',
  MANUAL_PREX: 'Transferencia manual',
  STRIPE: 'Stripe',
};

function labelOf(map: Record<string, string>, key: string): string {
  return map[key] ?? key;
}

export function PaymentsPage() {
  const toast = useAppToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCode = searchParams.get('code') ?? '';
  const [code, setCode] = useState(initialCode);
  const [lookup, setLookup] = useState(initialCode);
  const [error, setError] = useState<string | null>(null);

  const { data: paymentsData } = useMyPayments();
  const { data: escrowData, isFetching } = useEscrow(lookup);
  const checkout = useStartCheckout(lookup);
  const release = useReleaseEscrow(lookup);

  const escrow = escrowData?.data;
  const statusParam = searchParams.get('status');

  useEffect(() => {
    if (statusParam === 'success') {
      toast.success('Contratación del Agente confirmada.');
    } else if (statusParam === 'failure') {
      setError('El pago falló o fue cancelado en Mercado Pago.');
    }
  }, [statusParam, toast]);

  const onLookup = (event: FormEvent) => {
    event.preventDefault();
    const next = code.trim().toUpperCase();
    setLookup(next);
    setSearchParams(next ? { code: next } : {});
    setError(null);
  };

  const onCheckout = async () => {
    setError(null);
    try {
      const result = await checkout.mutateAsync();
      toast.success('Redirigiendo a Mercado Pago…');
      if (result.checkoutUrl && result.checkoutUrl !== '#') {
        window.location.href = result.checkoutUrl;
      }
    } catch {
      setError(
        'No se pudo iniciar el pago. ¿Sos el comprador y la operación está aceptada?',
      );
    }
  };

  const onRelease = async () => {
    setError(null);
    try {
      await release.mutateAsync();
      toast.success(
        'Operación cerrada. La comisión del Agente quedó acreditada en wallet (pendiente unos días).',
      );
    } catch {
      setError(
        'No se pudo completar. ¿La contratación del Agente ya está confirmada y la entrega lista?',
      );
    }
  };

  const statusLabel = escrow
    ? STATUS_LABELS[escrow.status as TransactionStatus] ?? escrow.status
    : null;
  const feePayerLabel = escrow?.feePayer
    ? FEE_PAYER_LABELS[escrow.feePayer as FeePayer] ?? escrow.feePayer
    : null;
  /** Modo vigente: sin precio de producto en la app. */
  const isAgentFeeOnly =
    (escrow?.productCents ?? escrow?.split.productCents ?? 0) === 0;

  return (
    <div className="ca-payments">
      <header className="ca-payments__header">
        <div>
          <p className="ca-payments__kicker">Pagos</p>
          <h2 className="ca-payments__title">Contratación del Agente</h2>
          <p className="ca-payments__lead">
            Seguimiento del pago del servicio del Agente y movimientos asociados.
          </p>
        </div>
      </header>

      <section className="ca-payments-panel">
        <Form className="ca-payments__lookup" onSubmit={onLookup}>
          <Form.Group>
            <Form.Label>Código de operación</Form.Label>
            <Form.Control
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="CONF-…"
            />
          </Form.Group>
          <Button type="submit" className="ca-btn-primary align-self-end">
            Ver operación
          </Button>
        </Form>
      </section>

      {error ? <Alert variant="danger">{error}</Alert> : null}

      {lookup ? (
        <section className="ca-payments-panel">
          <div className="ca-payments__row">
            <h3 className="mb-0">Operación {lookup}</h3>
            {isFetching ? <Spinner size="sm" animation="border" /> : null}
          </div>
          {escrow ? (
            <>
              <div className="ca-payments__meta">
                <span>
                  Estado: <strong>{statusLabel}</strong>
                </span>
                {isAgentFeeOnly ? (
                  <span>
                    En la app: <strong>solo contratación del Agente</strong>
                  </span>
                ) : feePayerLabel ? (
                  <span>
                    Comisión: <strong>{feePayerLabel}</strong>
                  </span>
                ) : null}
              </div>

              {isAgentFeeOnly ? (
                <div className="ca-payments-split">
                  <div>
                    <span>Contratación del Agente</span>
                    <strong>
                      {formatOperationMoney(
                        escrow.split.buyerPaysCents ??
                          escrow.commissionCents ??
                          escrow.split.commissionCents,
                        escrow.currency,
                      )}
                    </strong>
                  </div>
                  <div>
                    <span>Paga el comprador</span>
                    <strong>
                      {formatOperationMoney(
                        escrow.split.buyerPaysCents ?? escrow.grossCents,
                        escrow.currency,
                      )}
                    </strong>
                  </div>
                </div>
              ) : (
                <div className="ca-payments-split">
                  <div>
                    <span>Precio acordado</span>
                    <strong>
                      {formatOperationMoney(
                        escrow.productCents ?? escrow.split.productCents,
                        escrow.currency,
                      )}
                    </strong>
                  </div>
                  <div>
                    <span>Comisión de intermediación</span>
                    <strong>
                      {formatOperationMoney(
                        escrow.commissionCents ?? escrow.split.commissionCents,
                        escrow.currency,
                      )}
                    </strong>
                  </div>
                  <div>
                    <span>Comprador paga</span>
                    <strong>
                      {formatOperationMoney(
                        escrow.split.buyerPaysCents ?? escrow.grossCents,
                        escrow.currency,
                      )}
                    </strong>
                  </div>
                  <div>
                    <span>Vendedor recibe</span>
                    <strong>
                      {formatOperationMoney(escrow.split.sellerCents, escrow.currency)}
                    </strong>
                  </div>
                </div>
              )}

              <div className="ca-payments-split ca-payments-split--fees">
                <div>
                  <span>
                    {isAgentFeeOnly
                      ? 'ConfiApp (30% de la contratación)'
                      : 'ConfiApp (30% de la comisión)'}
                  </span>
                  <strong>
                    {formatOperationMoney(escrow.split.platformFeeCents, escrow.currency)}
                  </strong>
                </div>
                <div>
                  <span>
                    {isAgentFeeOnly
                      ? 'Agente (70% de la contratación)'
                      : 'Agente (70% de la comisión)'}
                  </span>
                  <strong>
                    {formatOperationMoney(escrow.split.agentFeeCents, escrow.currency)}
                  </strong>
                </div>
              </div>

              <div className="ca-form-actions">
                {escrow.status === 'ACCEPTED' ? (
                  <Button
                    className="ca-btn-cta"
                    disabled={checkout.isPending}
                    onClick={() => void onCheckout()}
                  >
                    {checkout.isPending ? 'Creando…' : 'Pagar con Mercado Pago'}
                  </Button>
                ) : null}
                {escrow.status === 'FUNDED' || escrow.status === 'IN_PROGRESS' ? (
                  <Button
                    variant="outline-secondary"
                    disabled={release.isPending}
                    onClick={() => void onRelease()}
                  >
                    {release.isPending ? 'Cerrando…' : 'Completar operación'}
                  </Button>
                ) : null}
                <Link className="btn btn-link" to={`/operaciones/${escrow.code}`}>
                  Ir a la operación
                </Link>
              </div>

              {escrow.payments.length > 0 ? (
                <Table responsive size="sm" className="mb-0 mt-3">
                  <thead>
                    <tr>
                      <th>Movimiento</th>
                      <th>Estado</th>
                      <th>Monto</th>
                      <th>Medio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {escrow.payments.map((p) => (
                      <tr key={p.id}>
                        <td>{labelOf(PAYMENT_TYPE_LABELS, p.type)}</td>
                        <td>{labelOf(PAYMENT_STATUS_LABELS, p.status)}</td>
                        <td>{formatOperationMoney(p.amountCents, p.currency)}</td>
                        <td>{labelOf(PROVIDER_LABELS, p.provider)}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              ) : (
                <p className="ca-payments__hint">Sin movimientos aún.</p>
              )}
            </>
          ) : !isFetching ? (
            <p className="ca-payments__hint">No encontramos esa operación o no tenés acceso.</p>
          ) : null}
        </section>
      ) : null}

      <section className="ca-payments-panel">
        <h3>Mis pagos</h3>
        {(paymentsData?.items.length ?? 0) === 0 ? (
          <p className="ca-payments__hint">No hay pagos registrados para tu usuario.</p>
        ) : (
          <Table responsive size="sm" className="mb-0">
            <thead>
              <tr>
                <th>Movimiento</th>
                <th>Estado</th>
                <th>Monto</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {paymentsData?.items.map((p) => (
                <tr key={p.id}>
                  <td>{labelOf(PAYMENT_TYPE_LABELS, p.type)}</td>
                  <td>{labelOf(PAYMENT_STATUS_LABELS, p.status)}</td>
                  <td>{formatOperationMoney(p.amountCents, p.currency)}</td>
                  <td>{formatDateTime(p.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </section>
    </div>
  );
}
