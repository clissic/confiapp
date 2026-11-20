import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Alert, Badge, Button, Spinner } from 'react-bootstrap';

import { apiClient, getApiErrorMessage } from '@/shared/api/client';
import { formatOperationMoney } from '@/shared/lib/money';
import { useAppToast } from '@/shared/ui';

const PROBE_AMOUNT_CENTS = 1_000;

type ProbeResponse = {
  amountCents: number;
  currency: string;
  preferenceId: string;
  checkoutUrl: string;
  providerMode: 'MERCADOPAGO' | 'MOCK';
  externalReference: string;
  isMock: boolean;
};

/**
 * Página oculta (sin nav) para probar Checkout Pro con UYU $10.
 * Ruta: /_lab/mp-probe — solo ADMIN.
 */
export function MercadoPagoProbePage() {
  const toast = useAppToast();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [lastProbe, setLastProbe] = useState<ProbeResponse | null>(null);

  const returnStatus = searchParams.get('status');
  const mpPaymentId =
    searchParams.get('payment_id') ||
    searchParams.get('collection_id') ||
    searchParams.get('paymentId');
  const externalReference =
    searchParams.get('external_reference') || searchParams.get('externalReference');

  const returnBanner = useMemo(() => {
    if (returnStatus === 'success') {
      return {
        variant: 'success' as const,
        text: 'MP devolvió success. Si las credenciales son de producción, el cobro debería figurar en tu cuenta de Mercado Pago.',
      };
    }
    if (returnStatus === 'failure') {
      return {
        variant: 'danger' as const,
        text: 'MP devolvió failure (pago rechazado o cancelado).',
      };
    }
    if (returnStatus === 'pending') {
      return {
        variant: 'warning' as const,
        text: 'MP devolvió pending. El pago puede demorar en acreditarse.',
      };
    }
    return null;
  }, [returnStatus]);

  const onStartProbe = async () => {
    setError(null);
    setPending(true);
    try {
      const { data } = await apiClient.post<ProbeResponse>('/payments/probe/mercadopago');
      setLastProbe(data);
      if (!data.checkoutUrl) {
        setError('La preferencia se creó pero no vino checkoutUrl.');
        return;
      }
      toast.success(
        data.isMock
          ? 'Modo MOCK (sin token MP). Redirigiendo a bridge de prueba…'
          : 'Preferencia creada. Abriendo Mercado Pago…',
      );
      window.location.href = data.checkoutUrl;
    } catch (err) {
      setError(
        getApiErrorMessage(
          err,
          'No se pudo crear la preferencia. Revisá MERCADOPAGO_ACCESS_TOKEN y el modo de checkout.',
        ),
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="container py-4" style={{ maxWidth: 520 }}>
      <p className="text-muted small mb-1">Lab oculto · solo admin</p>
      <h1 className="h3 mb-2">Probe Mercado Pago</h1>
      <p className="text-secondary mb-3">
        Cobra <strong>{formatOperationMoney(PROBE_AMOUNT_CENTS, 'UYU')}</strong> vía Checkout Pro
        para validar credenciales de producción. No crea operación ni wallet: solo una preferencia
        de prueba.
      </p>

      {returnBanner ? <Alert variant={returnBanner.variant}>{returnBanner.text}</Alert> : null}

      {(mpPaymentId || externalReference) && (
        <Alert variant="info" className="small">
          {mpPaymentId ? (
            <div>
              <strong>payment_id:</strong> {mpPaymentId}
            </div>
          ) : null}
          {externalReference ? (
            <div>
              <strong>external_reference:</strong> {externalReference}
            </div>
          ) : null}
        </Alert>
      )}

      {error ? <Alert variant="danger">{error}</Alert> : null}

      {lastProbe ? (
        <div className="mb-3 small text-muted">
          Última preferencia: <code>{lastProbe.preferenceId}</code>{' '}
          <Badge bg={lastProbe.isMock ? 'secondary' : 'success'}>
            {lastProbe.providerMode}
          </Badge>
        </div>
      ) : null}

      <Button
        type="button"
        className="ca-btn-cta"
        disabled={pending}
        onClick={() => void onStartProbe()}
      >
        {pending ? (
          <>
            <Spinner size="sm" animation="border" className="me-2" />
            Creando preferencia…
          </>
        ) : (
          `Pagar ${formatOperationMoney(PROBE_AMOUNT_CENTS, 'UYU')} en Mercado Pago`
        )}
      </Button>
    </div>
  );
}
