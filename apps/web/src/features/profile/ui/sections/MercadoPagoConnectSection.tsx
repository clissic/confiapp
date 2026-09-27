import { Alert, Button, OverlayTrigger, Popover, Spinner } from 'react-bootstrap';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Info, Link2, Unlink } from 'lucide-react';

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

const HELP_COPY = {
  title: 'Cobros con Mercado Pago',
  body: [
    'En un futuro, al cerrar una operación podremos acreditar automáticamente en tu billetera de Mercado Pago, sin esperar la liquidación mensual.',
    'Si no vinculás, usá un método de cobro alternativo. Podés seguir tomando trabajos: las comisiones van a tu wallet y el pago queda pendiente hasta conectar.',
    'No pedimos tu contraseña: usás el login oficial de Mercado Pago.',
  ],
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

function MpHelpPopover() {
  return (
    <Popover id="mp-connect-help" className="ca-mp-connect-popover">
      <Popover.Header as="h4">{HELP_COPY.title}</Popover.Header>
      <Popover.Body>
        {HELP_COPY.body.map((p) => (
          <p key={p.slice(0, 24)} className="ca-mp-connect-popover__p">
            {p}
          </p>
        ))}
      </Popover.Body>
    </Popover>
  );
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
      <div className="ca-mp-connect__toolbar">
        <MercadoPagoLogo width={152} />
        <OverlayTrigger
          trigger={['click', 'focus']}
          placement="bottom-end"
          rootClose
          overlay={<MpHelpPopover />}
        >
          <button type="button" className="ca-mp-connect__info" aria-label="Información sobre Mercado Pago">
            <Info size={18} strokeWidth={1.75} aria-hidden />
          </button>
        </OverlayTrigger>
      </div>

      {linkError ? (
        <Alert variant="danger" className="mb-0" dismissible onClose={() => setLinkError(null)}>
          <strong>Error de vinculación</strong>
          <div className="small mt-1" style={{ wordBreak: 'break-word' }}>
            {linkError}
          </div>
        </Alert>
      ) : null}

      {loading ? (
        <div className="ca-mp-connect__quiet" role="status">
          <Spinner animation="border" size="sm" />
          <span>Cargando…</span>
        </div>
      ) : null}

      {!loading && connectionQuery.isError ? (
        <Alert variant="danger" className="mb-0">
          No se pudo consultar el estado de Mercado Pago.
        </Alert>
      ) : null}

      {!loading && connection && !oauthReady && !connected ? (
        <Alert variant="secondary" className="mb-0">
          La vinculación OAuth aún no está configurada en el servidor.
        </Alert>
      ) : null}

      {!loading && connection?.status === 'EXPIRED' ? (
        <Alert variant="warning" className="mb-0">
          La sesión de Mercado Pago venció. Volvé a conectar tu cuenta.
        </Alert>
      ) : null}

      {!loading && connection?.status === 'ERROR' && !linkError ? (
        <Alert variant="danger" className="mb-0">
          Hubo un problema con la vinculación
          {connection.lastError ? `: ${connection.lastError}` : ''}.
        </Alert>
      ) : null}

      {!loading && connected ? (
        <article className="ca-mp-connect__panel ca-mp-connect__panel--ok">
          <div className="ca-mp-connect__panel-bar">
            <span className="ca-mp-connect__status">Conectada</span>
          </div>
          <dl className="ca-mp-connect__facts">
            {connection?.publicNickname ? (
              <div className="ca-mp-connect__fact">
                <dt>Cuenta</dt>
                <dd>{connection.publicNickname}</dd>
              </div>
            ) : null}
            {connection?.email ? (
              <div className="ca-mp-connect__fact">
                <dt>Email</dt>
                <dd>{connection.email}</dd>
              </div>
            ) : null}
            {connection?.mpUserId ? (
              <div className="ca-mp-connect__fact">
                <dt>ID</dt>
                <dd className="ca-mp-connect__mono">{maskMpUserId(connection.mpUserId)}</dd>
              </div>
            ) : null}
          </dl>
          <Button
            variant="outline-danger"
            size="sm"
            className="ca-mp-connect__action d-inline-flex align-items-center gap-2"
            disabled={disconnect.isPending}
            onClick={() => void onDisconnect()}
          >
            <Unlink size={15} strokeWidth={1.75} aria-hidden />
            {disconnect.isPending ? 'Desconectando…' : 'Desconectar'}
          </Button>
        </article>
      ) : null}

      {!loading && !connected ? (
        <article className="ca-mp-connect__panel ca-mp-connect__panel--idle">
          <p className="ca-mp-connect__idle-title">Sin cuenta vinculada</p>
          <p className="ca-mp-connect__idle-text">
            Conectá tu cuenta para cobrar comisiones por Mercado Pago cuando esté disponible.
          </p>
          <Button
            className="ca-btn-cta ca-mp-connect__action d-inline-flex align-items-center gap-2"
            disabled={!oauthReady || startOAuth.isPending}
            onClick={() => void onConnect()}
          >
            <Link2 size={16} strokeWidth={1.75} aria-hidden />
            {startOAuth.isPending ? 'Redirigiendo…' : 'Conectar cuenta'}
          </Button>
        </article>
      ) : null}
    </section>
  );
}
