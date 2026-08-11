import { useMemo, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { Alert, Button, Spinner } from 'react-bootstrap';
import { ShieldCheck } from 'lucide-react';
import {
  computeIntermediationFees,
  DEFAULT_UYU_PER_USD,
  type FeePayer,
} from '@confiapp/shared';

import { apiClient, getApiErrorMessage } from '@/shared/api/client';
import { formatOperationMoney } from '@/shared/lib/money';
import { useAppToast } from '@/shared/ui';

import { useTransaction } from '../hooks/useTransactions';
import '../styles/transactions.css';

/**
 * Pasarela simulada (sin MERCADOPAGO_ACCESS_TOKEN).
 * Con credenciales reales, Mercado Pago Checkout Pro reemplaza este paso.
 */
export function TransactionPayMockPage() {
  const { code = '' } = useParams();
  const [searchParams] = useSearchParams();
  const paymentId = searchParams.get('paymentId') ?? '';
  const toast = useAppToast();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const { data, isLoading, isError } = useTransaction(code);
  const tx = data?.data;

  const feePreview = useMemo(() => {
    if (!tx?.amountCents || tx.amountCents <= 0) return null;
    try {
      return computeIntermediationFees({
        productCents: tx.amountCents,
        currency: tx.currency || 'UYU',
        feePayer: (tx.feePayer ?? 'BUYER') as FeePayer,
        uyuPerUsd: DEFAULT_UYU_PER_USD,
      });
    } catch {
      return null;
    }
  }, [tx?.amountCents, tx?.currency, tx?.feePayer]);

  if (isLoading) {
    return (
      <div className="ca-tx ca-tx--loading">
        <Spinner animation="border" />
        <span>Abriendo pasarela de prueba…</span>
      </div>
    );
  }

  if (isError || !tx) {
    return (
      <Alert variant="danger" className="m-3">
        No se encontró la operación.{' '}
        <Link to="/operaciones">Volver</Link>
      </Alert>
    );
  }

  if (!paymentId) {
    return <Navigate to={`/operaciones/${tx.code}/pagar`} replace />;
  }

  if (tx.status === 'FUNDED' || tx.status === 'IN_PROGRESS' || tx.status === 'COMPLETED') {
    return <Navigate to={`/operaciones/${tx.code}?pago=ok`} replace />;
  }

  const onApprove = async () => {
    setError(null);
    setPending(true);
    try {
      await apiClient.post(`/payments/mock/confirm/${encodeURIComponent(paymentId)}`);
      toast.success('Pago de prueba aprobado.');
      window.location.href = `/operaciones/${encodeURIComponent(tx.code)}?pago=ok`;
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudo simular el pago.'));
      setPending(false);
    }
  };

  return (
    <div className="ca-tx ca-tx--pay-mock">
      <section className="ca-tx-panel ca-tx-pay-mock-card">
        <p className="ca-tx-pay-hero__kicker">
          <ShieldCheck size={16} strokeWidth={1.75} aria-hidden />
          Mercado Pago · modo prueba
        </p>
        <h1 className="ca-tx-pay-hero__title">Simular pago</h1>
        <p className="ca-tx-pay-hero__lead">
          Todavía no hay credenciales sandbox. Esta pantalla imita la pasarela: al aprobar,
          el pago queda protegido como si Mercado Pago hubiera confirmado el cobro.
        </p>

        <div className="ca-tx-pay-mock-card__amount">
          <span>Vas a pagar</span>
          <strong>
            {formatOperationMoney(
              feePreview?.buyerPaysCents ?? tx.amountCents,
              tx.currency,
            )}
          </strong>
          <span className="ca-tx-pay-mock-card__code">{tx.code}</span>
        </div>

        {error ? <Alert variant="danger">{error}</Alert> : null}

        <div className="ca-form-actions ca-tx-pay-cta__actions">
          <Button className="ca-btn-cta" disabled={pending} onClick={() => void onApprove()}>
            {pending ? (
              <>
                <Spinner size="sm" animation="border" className="me-2" />
                Confirmando…
              </>
            ) : (
              'Aprobar pago de prueba'
            )}
          </Button>
          <Link to={`/operaciones/${tx.code}/pagar`} className="btn btn-link px-0">
            Volver al resumen
          </Link>
        </div>
      </section>
    </div>
  );
}
