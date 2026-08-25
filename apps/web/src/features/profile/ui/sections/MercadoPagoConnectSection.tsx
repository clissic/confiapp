import { Alert, Button, Spinner } from 'react-bootstrap';
import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Link2, Unlink } from 'lucide-react';

import {
  useDisconnectMercadoPago,
  useMercadoPagoConnection,
  useStartMercadoPagoOAuth,
} from '@/features/payments/hooks/usePayments';
import { useAppToast } from '@/shared/ui';

const ERROR_MESSAGES: Record<string, string> = {
  cancelled: 'Cancelaste la vinculación con Mercado Pago.',
  oauth_denied: 'Mercado Pago denegó el acceso.',
  missing_params: 'Faltaron datos en la respuesta de Mercado Pago.',
  invalid_state: 'La sesión de vinculación no es válida. Probá de nuevo.',
  expired_state: 'La vinculación expiró. Probá de nuevo.',
  mp_account_in_use: 'Esa cuenta de Mercado Pago ya está vinculada a otro usuario.',
  exchange_failed: 'No se pudo completar la vinculación. Probá de nuevo.',
};

function maskMpUserId(id: string): string {
  if (id.length <= 4) return id;
  return `••••${id.slice(-4)}`;
}

export function MercadoPagoConnectSection() {
  const toast = useAppToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const toastHandled = useRef(false);

  const connectionQuery = useMercadoPagoConnection();
  const startOAuth = useStartMercadoPagoOAuth();
  const disconnect = useDisconnectMercadoPago();

  useEffect(() => {
    if (toastHandled.current) return;
    const mp = searchParams.get('mp');
    if (!mp) return;
    toastHandled.current = true;
    if (mp === 'ok') {
      toast.success('Mercado Pago conectado correctamente.');
      void connectionQuery.refetch();
    } else if (mp === 'error') {
      const reason = searchParams.get('reason') ?? '';
      toast.error(ERROR_MESSAGES[reason] ?? 'No se pudo vincular Mercado Pago.');
    }
    const next = new URLSearchParams(searchParams);
    next.delete('mp');
    next.delete('reason');
    if (!next.get('tab')) next.set('tab', 'settings');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, toast, connectionQuery]);

  const connection = connectionQuery.data?.data;
  const loading = connectionQuery.isLoading;
  const connected = Boolean(connection?.connected);
  const oauthReady = Boolean(connection?.oauthConfigured);

  const onConnect = async () => {
    try {
      const { authorizationUrl } = await startOAuth.mutateAsync();
      window.location.assign(authorizationUrl);
    } catch {
      toast.error('No se pudo iniciar la vinculación con Mercado Pago.');
    }
  };

  const onDisconnect = async () => {
    try {
      await disconnect.mutateAsync();
      toast.success('Mercado Pago desconectado.');
    } catch {
      toast.error('No se pudo desconectar Mercado Pago.');
    }
  };

  return (
    <section id="mercadopago-conexion" className="ca-payout">
      <h3 className="ca-section-title">
        <Link2 size={22} strokeWidth={1.75} aria-hidden />
        Mercado Pago
      </h3>
      <p className="ca-section-lead">
        Vinculá tu cuenta de Mercado Pago para cobrar ventas de forma segura. No compartimos tu
        contraseña: usás el inicio de sesión oficial de Mercado Pago.
      </p>

      {loading ? (
        <div className="d-flex align-items-center gap-2 text-muted">
          <Spinner animation="border" size="sm" />
          <span>Cargando estado…</span>
        </div>
      ) : null}

      {!loading && connectionQuery.isError ? (
        <Alert variant="danger">No se pudo consultar el estado de Mercado Pago.</Alert>
      ) : null}

      {!loading && connection && !oauthReady && !connected ? (
        <Alert variant="secondary" className="mb-3">
          La vinculación OAuth aún no está configurada en el servidor. Podés seguir usando métodos
          de cobro bancarios.
        </Alert>
      ) : null}

      {!loading && connection?.status === 'EXPIRED' ? (
        <Alert variant="warning" className="mb-3">
          La sesión de Mercado Pago venció. Volvé a conectar tu cuenta.
        </Alert>
      ) : null}

      {!loading && connection?.status === 'ERROR' ? (
        <Alert variant="danger" className="mb-3">
          Hubo un problema con la vinculación
          {connection.lastError ? ` (${connection.lastError})` : ''}. Probá reconectar.
        </Alert>
      ) : null}

      {!loading && connected ? (
        <div className="ca-fieldset p-3 mb-2">
          <p className="mb-1 fw-semibold" style={{ color: 'var(--text-primary)' }}>
            Cuenta conectada
          </p>
          <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
            {connection?.publicNickname ? (
              <span className="badge text-bg-light border">{connection.publicNickname}</span>
            ) : null}
            {connection?.email ? (
              <span className="badge text-bg-light border">{connection.email}</span>
            ) : null}
            {connection?.mpUserId ? (
              <span className="badge text-bg-secondary">
                ID {maskMpUserId(connection.mpUserId)}
              </span>
            ) : null}
          </div>
          <Button
            variant="outline-danger"
            className="d-inline-flex align-items-center gap-2"
            disabled={disconnect.isPending}
            onClick={() => void onDisconnect()}
          >
            <Unlink size={16} strokeWidth={1.75} aria-hidden />
            {disconnect.isPending ? 'Desconectando…' : 'Desconectar'}
          </Button>
        </div>
      ) : null}

      {!loading && !connected ? (
        <Button
          className="ca-btn-cta d-inline-flex align-items-center gap-2"
          disabled={!oauthReady || startOAuth.isPending}
          onClick={() => void onConnect()}
        >
          <Link2 size={16} strokeWidth={1.75} aria-hidden />
          {startOAuth.isPending ? 'Redirigiendo…' : 'Conectar Mercado Pago'}
        </Button>
      ) : null}
    </section>
  );
}
