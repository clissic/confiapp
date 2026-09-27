import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import { env } from '@/shared/config/env';

/**
 * Redirect público de Mercado Pago (OAuth).
 * MP solo acepta una Redirect URL estática; usamos la web y reenviamos el code
 * al callback del API para el canje del token.
 */
export function MercadoPagoOAuthCallbackPage() {
  const [params] = useSearchParams();

  const target = useMemo(() => {
    const apiBase = env.apiUrl.replace(/\/$/, '');
    const qs = params.toString();
    const path = `/payments/mercadopago/oauth/callback${qs ? `?${qs}` : ''}`;
    return `${apiBase}${path}`;
  }, [params]);

  useEffect(() => {
    window.location.replace(target);
  }, [target]);

  return (
    <div className="d-flex justify-content-center align-items-center min-vh-100">
      <p className="text-muted mb-0">Completando vinculación con Mercado Pago…</p>
    </div>
  );
}
