import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Alert, Badge, Button, Spinner } from 'react-bootstrap';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import {
  computeIntermediationFees,
  DEFAULT_UYU_PER_USD,
  FEE_PAYER_LABELS,
  type FeePayer,
} from '@confiapp/shared';

import { getApiErrorMessage } from '@/shared/api/client';
import { formatOperationMoney } from '@/shared/lib/money';
import { useAppToast } from '@/shared/ui';
import { useStartCheckout } from '@/features/payments/hooks/usePayments';

import { useTransaction } from '../hooks/useTransactions';
import { STATUS_LABELS } from '../model/types';
import '../styles/transactions.css';

export function TransactionPayPage() {
  const { code = '' } = useParams();
  const navigate = useNavigate();
  const toast = useAppToast();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, isError } = useTransaction(code);
  const checkout = useStartCheckout(code);
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
    } catch (err) {
      return err instanceof Error ? err.message : 'No se pudo calcular el desglose';
    }
  }, [tx?.amountCents, tx?.currency, tx?.feePayer]);

  useEffect(() => {
    const status = searchParams.get('status') ?? searchParams.get('pago');
    if (status === 'success' || status === 'ok') {
      toast.success('Pago confirmado. El monto quedó en resguardo.');
      navigate(`/operaciones/${code}`, { replace: true });
    } else if (status === 'failure') {
      setError('El pago falló o fue cancelado. Podés intentarlo de nuevo.');
    }
  }, [searchParams, toast, navigate, code]);

  if (isLoading) {
    return (
      <div className="ca-tx ca-tx--loading">
        <Spinner animation="border" />
        <span>Preparando el resumen…</span>
      </div>
    );
  }

  if (isError || !tx) {
    return (
      <Alert variant="danger" className="m-3">
        No se encontró la operación.{' '}
        <Link to="/operaciones">Volver al listado</Link>
      </Alert>
    );
  }

  if (tx.status === 'FUNDED' || tx.status === 'IN_PROGRESS' || tx.status === 'COMPLETED') {
    return <Navigate to={`/operaciones/${tx.code}`} replace />;
  }

  if (tx.status !== 'ACCEPTED' || tx.viewerRole !== 'BUYER') {
    return (
      <Alert variant="warning" className="m-3">
        Solo el comprador puede pagar cuando la operación está aceptada.{' '}
        <Link to={`/operaciones/${tx.code}`}>Volver a la operación</Link>
      </Alert>
    );
  }

  if (typeof feePreview === 'string') {
    return (
      <Alert variant="danger" className="m-3">
        {feePreview}{' '}
        <Link to={`/operaciones/${tx.code}`}>Volver</Link>
      </Alert>
    );
  }

  if (!feePreview) {
    return (
      <Alert variant="danger" className="m-3">
        Falta el monto de la operación.{' '}
        <Link to={`/operaciones/${tx.code}`}>Volver</Link>
      </Alert>
    );
  }

  const onContinueToCheckout = async () => {
    setError(null);
    try {
      const result = await checkout.mutateAsync();
      if (result.checkoutUrl && result.checkoutUrl !== '#') {
        toast.success(
          result.providerMode === 'MOCK'
            ? 'Modo prueba: simulando la pasarela de pago…'
            : 'Redirigiendo a Mercado Pago…',
        );
        window.location.href = result.checkoutUrl;
        return;
      }
      setError('No se obtuvo la URL de pago. Probá de nuevo en unos segundos.');
    } catch (err) {
      setError(
        getApiErrorMessage(
          err,
          'No se pudo iniciar el checkout. Revisá que la operación siga aceptada.',
        ),
      );
    }
  };

  const feePayerLabel =
    FEE_PAYER_LABELS[(tx.feePayer ?? feePreview.feePayer) as FeePayer] ??
    tx.feePayer ??
    feePreview.feePayer;

  return (
    <div className="ca-tx ca-tx--pay">
      <header className="ca-tx-pay-hero">
        <Link to={`/operaciones/${tx.code}`} className="ca-tx-pay-hero__back">
          <ArrowLeft size={16} strokeWidth={1.75} aria-hidden />
          Volver a la operación
        </Link>
        <p className="ca-tx-pay-hero__kicker">
          <ShieldCheck size={16} strokeWidth={1.75} aria-hidden />
          Pago protegido
        </p>
        <h1 className="ca-tx-pay-hero__title">Resumen del pago</h1>
        <p className="ca-tx-pay-hero__lead">
          Revisá los montos. Al continuar vas a la pasarela de Mercado Pago para completar el
          cobro; el dinero queda en resguardo hasta confirmar la entrega.
        </p>
        <div className="ca-tx-pay-hero__meta">
          <Badge bg="primary">{STATUS_LABELS[tx.status]}</Badge>
          <span>{tx.code}</span>
          <span>{tx.title}</span>
        </div>
      </header>

      {error ? <Alert variant="danger">{error}</Alert> : null}

      <section className="ca-tx-panel ca-tx-pay-summary">
        <h2 className="ca-tx-pay-summary__heading">Desglose</h2>
        <ul className="ca-tx-pay-summary__list">
          <li>
            <span>Precio acordado</span>
            <strong>
              {formatOperationMoney(feePreview.productCents, tx.currency)}
            </strong>
          </li>
          <li>
            <span>Comisión de intermediación</span>
            <strong>
              {formatOperationMoney(feePreview.commissionCents, tx.currency)}
            </strong>
          </li>
          <li>
            <span>Quién paga la comisión</span>
            <strong>{feePayerLabel}</strong>
          </li>
          <li className="ca-tx-pay-summary__total">
            <span>Total a pagar ahora</span>
            <strong>
              {formatOperationMoney(feePreview.buyerPaysCents, tx.currency)}
            </strong>
          </li>
          <li>
            <span>El vendedor recibe</span>
            <strong>
              {formatOperationMoney(feePreview.sellerNetCents, tx.currency)}
            </strong>
          </li>
        </ul>

        <div className="ca-tx-pay-summary__fees">
          <p>De la comisión de intermediación:</p>
          <div className="ca-tx-pay-summary__fees-row">
            <span>
              ConfiApp 20%:{' '}
              {formatOperationMoney(feePreview.platformFeeCents, tx.currency)}
            </span>
            <span>
              Agente 80%:{' '}
              {formatOperationMoney(feePreview.agentFeeCents, tx.currency)}
            </span>
          </div>
        </div>
      </section>

      <section className="ca-tx-panel ca-tx-pay-cta">
        <div className="ca-tx-pay-cta__copy">
          <h2 className="ca-tx-pay-cta__title">Último paso</h2>
          <p className="ca-tx-pay-cta__lead mb-0">
            Vas a pagar{' '}
            <strong>
              {formatOperationMoney(feePreview.buyerPaysCents, tx.currency)}
            </strong>{' '}
            en Mercado Pago. Si estás en modo prueba (sin credenciales), se simula la pasarela.
          </p>
        </div>
        <div className="ca-tx-pay-cta__actions">
          <Button
            className="ca-btn-cta"
            disabled={checkout.isPending}
            onClick={() => void onContinueToCheckout()}
          >
            {checkout.isPending ? (
              <>
                <Spinner size="sm" animation="border" className="me-2" />
                Abriendo pasarela…
              </>
            ) : (
              'Continuar a Mercado Pago'
            )}
          </Button>
          <Link to={`/operaciones/${tx.code}`} className="btn btn-link px-0">
            Cancelar
          </Link>
        </div>
      </section>
    </div>
  );
}
