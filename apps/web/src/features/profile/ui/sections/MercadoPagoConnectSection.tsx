import { Alert, Button, Spinner } from 'react-bootstrap';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Link2, Unlink } from 'lucide-react';

import {
  useDisconnectMercadoPago,
  useMercadoPagoConnection,
  useStartMercadoPagoOAuth,
} from '@/features/payments/hooks/usePayments';
import { MercadoPagoLogo } from '@/shared/branding/MercadoPagoLogo';
import { useAppToast } from '@/shared/ui';

import '../../styles/mercadopago-connect.css';

const ERROR_MESSAGES: Record<string, string> = {
  cancelled: 'Cancelaste la vinculación con Mercado Pago.',
  oauth_denied: 'Mercado Pago denegó el acceso.',
  missing_params: 'Faltaron datos en la respuesta de Mercado Pago.',
  invalid_state: 'La sesión de vinculación no es válida. Probá de nuevo.',
  expired_state: 'La vinculación expiró. Probá de nuevo.',
  mp_account_in_use: 'Esa cuenta de Mercado Pago ya está vinculada a otro usuario.',
  token_failed:
    'Mercado Pago rechazó el canje del código (Client Secret / Redirect URI / PKCE).',
  profile_failed: 'Se autorizó, pero no se pudo leer el perfil de Mercado Pago.',
  exchange_failed: 'No se pudo completar la vinculación.',
};

function maskMpUserId(id: string): string {
  if (id.length <= 4) return id;
  return `••••${id.slice(-4)}`;
}

function formatLinkError(reason: string, detail: string): string {
  const base = ERROR_MESSAGES[reason] ?? 'No se pudo vincular Mercado Pago.';
  if (!detail) return `${base} (${reason || 'sin_motivo'})`;
  return `${base} [${reason || 'error'}] ${detail}`;
}

export function MercadoPagoConnectSection() {
  const toast = useAppToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const toastHandled = useRef(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  const connectionQuery = useMercadoPagoConnection();
  const startOAuth = useStartMercadoPagoOAuth();
  const disconnect = useDisconnectMercadoPago();

  useEffect(() => {
    if (toastHandled.current) return;
    const mp = searchParams.get('mp');
    if (!mp) return;
    toastHandled.current = true;
    if (mp === 'ok') {
      setLinkError(null);
      toast.success('Mercado Pago conectado correctamente.');
      void connectionQuery.refetch();
    } else if (mp === 'error') {
      const reason = searchParams.get('reason') ?? '';
      const detail = searchParams.get('detail') ?? '';
      const message = formatLinkError(reason, detail);
      setLinkError(message);
      toast.error(message);
    }
    const next = new URLSearchParams(searchParams);
    next.delete('mp');
    next.delete('reason');
    next.delete('detail');
    if (!next.get('tab')) next.set('tab', 'settings');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, toast, connectionQuery]);

  const connection = connectionQuery.data?.data;
  const loading = connectionQuery.isLoading;
  const connected = Boolean(connection?.connected);
  const oauthReady = Boolean(connection?.oauthConfigured);

  const onConnect = async () => {
    try {
      setLinkError(null);
      const { authorizationUrl } = await startOAuth.mutateAsync();
      window.location.assign(authorizationUrl);
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? `No se pudo iniciar la vinculación: ${err.message}`
          : 'No se pudo iniciar la vinculación con Mercado Pago.';
      setLinkError(message);
      toast.error(message);
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
    <section id="mercadopago-conexion" className="ca-mp-connect">
      <header className="ca-mp-connect__head">
        <div className="ca-mp-connect__brand-plate" title="Logo oficial — uso sobre fondo claro">
          <MercadoPagoLogo height={26} />
        </div>
        <div className="ca-mp-connect__head-copy">
          <h3 className="ca-mp-connect__title">Cobros con Mercado Pago</h3>
          <p className="ca-mp-connect__lead">
            En un futuro, al cerrar una operación podremos acreditar automáticamente en tu billetera
            de Mercado Pago, sin esperar la liquidación mensual. Si no vinculás, usá un método de
            cobro alternativo. Podés seguir tomando trabajos: las comisiones van a tu wallet y el
            pago queda pendiente hasta conectar. No pedimos tu contraseña: usás el login oficial de
            Mercado Pago.
          </p>
        </div>
      </header>

      {linkError ? (
        <Alert variant="danger" className="mb-3" dismissible onClose={() => setLinkError(null)}>
          <strong>Error de vinculación</strong>
          <div className="small mt-1" style={{ wordBreak: 'break-word' }}>
            {linkError}
          </div>
        </Alert>
      ) : null}

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

      {!loading && connection?.status === 'ERROR' && !linkError ? (
        <Alert variant="danger" className="mb-3">
          Hubo un problema con la vinculación
          {connection.lastError ? `: ${connection.lastError}` : ''}. Probá reconectar.
        </Alert>
      ) : null}

      {!loading && connected ? (
        <div className="ca-mp-connect__card ca-mp-connect__card--ok">
          <div className="ca-mp-connect__card-top">
            <div className="ca-mp-connect__brand-plate ca-mp-connect__brand-plate--sm">
              <MercadoPagoLogo height={22} />
            </div>
            <span className="ca-mp-connect__status">Conectada</span>
          </div>
          <p className="ca-mp-connect__card-title">Cuenta vinculada</p>
          <div className="ca-mp-connect__chips">
            {connection?.publicNickname ? (
              <span className="ca-mp-connect__chip">{connection.publicNickname}</span>
            ) : null}
            {connection?.email ? (
              <span className="ca-mp-connect__chip">{connection.email}</span>
            ) : null}
            {connection?.mpUserId ? (
              <span className="ca-mp-connect__chip ca-mp-connect__chip--muted">
                ID {maskMpUserId(connection.mpUserId)}
              </span>
            ) : null}
          </div>
          <Button
            variant="outline-danger"
            size="sm"
            className="ca-mp-connect__disconnect d-inline-flex align-items-center gap-2"
            disabled={disconnect.isPending}
            onClick={() => void onDisconnect()}
          >
            <Unlink size={15} strokeWidth={1.75} aria-hidden />
            {disconnect.isPending ? 'Desconectando…' : 'Desconectar'}
          </Button>
        </div>
      ) : null}

      {!loading && !connected ? (
        <div className="ca-mp-connect__card ca-mp-connect__card--idle">
          <div className="ca-mp-connect__brand-plate ca-mp-connect__brand-plate--sm">
            <MercadoPagoLogo height={22} />
          </div>
          <p className="ca-mp-connect__card-title">Todavía no vinculaste tu cuenta</p>
          <p className="ca-mp-connect__card-hint">
            El inicio de sesión es el oficial de Mercado Pago. ConfiApp no guarda tu contraseña.
          </p>
          <Button
            className="ca-btn-cta ca-mp-connect__cta d-inline-flex align-items-center gap-2"
            disabled={!oauthReady || startOAuth.isPending}
            onClick={() => void onConnect()}
          >
            <Link2 size={16} strokeWidth={1.75} aria-hidden />
            {startOAuth.isPending ? 'Redirigiendo…' : 'Conectar Mercado Pago'}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
