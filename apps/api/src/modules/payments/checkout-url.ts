/**
 * Resolución de la URL de Checkout Pro de Mercado Pago.
 *
 * MP devuelve `init_point` (producción) y también `sandbox_init_point`
 * aunque las credenciales sean productivas. Hay que priorizar siempre
 * `initPoint` para no mandar al comprador al sandbox.
 */

const MP_SANDBOX_CHECKOUT_MARKER = 'sandbox.mercadopago';

function trimUrl(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** True si la URL apunta al checkout de prueba de Mercado Pago. */
export function isMercadoPagoSandboxCheckoutUrl(url: string | undefined | null): boolean {
  return typeof url === 'string' && url.toLowerCase().includes(MP_SANDBOX_CHECKOUT_MARKER);
}

/**
 * Elige la URL de checkout de una preferencia.
 * Usa `initPoint` y solo cae a `sandboxInitPoint` si `initPoint` falta.
 */
export function resolveCheckoutUrl(preference: {
  initPoint?: string | null;
  sandboxInitPoint?: string | null;
}): string | undefined {
  const initPoint = trimUrl(preference.initPoint);
  const sandboxInitPoint = trimUrl(preference.sandboxInitPoint);
  if (initPoint) return initPoint;
  if (sandboxInitPoint) return sandboxInitPoint;
  return undefined;
}

/**
 * URL reutilizable de un hold ya persistido en metadata.
 * Si hay `initPoint` de producción, lo usa aunque también exista una URL de sandbox.
 * Si la única URL guardada es de sandbox, devuelve `undefined` para regenerar la preferencia.
 */
export function resolveReusableCheckoutUrl(meta: {
  initPoint?: unknown;
  sandboxInitPoint?: unknown;
}): string | undefined {
  const initPoint = trimUrl(meta.initPoint);
  const sandboxInitPoint = trimUrl(meta.sandboxInitPoint);
  const url = resolveCheckoutUrl({ initPoint, sandboxInitPoint });
  if (!url) return undefined;
  if (isMercadoPagoSandboxCheckoutUrl(url)) return undefined;
  return url;
}
