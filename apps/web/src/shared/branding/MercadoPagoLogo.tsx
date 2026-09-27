type MercadoPagoLogoProps = {
  className?: string;
  height?: number;
  markOnly?: boolean;
};

/**
 * Lockup Mercado Pago alineado a la guía
 * https://www.mercadopago.com.ar/mp/logo-oficial
 * Color de marca #009EE3; montar siempre sobre placa clara (light y dark de la app).
 */
export function MercadoPagoLogo({
  className = '',
  height = 28,
  markOnly = false,
}: MercadoPagoLogoProps) {
  const mark = Math.round(height);

  return (
    <span
      className={['ca-mp-logo', className].filter(Boolean).join(' ')}
      role="img"
      aria-label="Mercado Pago"
    >
      <svg
        className="ca-mp-logo__mark"
        width={mark}
        height={mark}
        viewBox="0 0 40 40"
        aria-hidden
        focusable="false"
      >
        <rect width="40" height="40" rx="9" fill="#009EE3" />
        <path
          fill="#fff"
          d="M28.2 9.6c-2.4-2.4-6.3-2.4-8.7 0L12.2 17c-1.1 1.1-1.8 2.7-1.8 4.3 0 3.3 2.7 6 6 6 1.6 0 3.1-.6 4.3-1.8l3.8-3.8c.3-.3.3-.8 0-1.1s-.8-.3-1.1 0l-3.8 3.8c-.8.8-2 1.3-3.2 1.3-2.5 0-4.5-2-4.5-4.5 0-1.2.5-2.3 1.3-3.2l7.3-7.3c1.8-1.8 4.7-1.8 6.5 0s1.8 4.7 0 6.5l-4.8 4.8c-.3.3-.3.8 0 1.1.2.2.4.2.5.2s.4-.1.5-.2l4.8-4.8c2.5-2.4 2.5-6.3.1-8.7z"
        />
        <path
          fill="#fff"
          d="M29.1 20.2c-1.6 0-3.1.6-4.3 1.8l-3.8 3.8c-.3.3-.3.8 0 1.1.2.2.4.2.5.2s.4-.1.5-.2l3.8-3.8c.8-.8 2-1.3 3.2-1.3 2.5 0 4.5 2 4.5 4.5 0 1.2-.5 2.3-1.3 3.2l-7.3 7.3c-1.8 1.8-4.7 1.8-6.5 0s-1.8-4.7 0-6.5l2.4-2.4c.3-.3.3-.8 0-1.1s-.8-.3-1.1 0l-2.4 2.4c-2.4 2.4-2.4 6.3 0 8.7 1.2 1.2 2.8 1.8 4.3 1.8s3.1-.6 4.3-1.8l9-9c1.1-1.1 1.8-2.7 1.8-4.3.1-3.4-2.6-6.1-5.9-6.1z"
        />
      </svg>
      {!markOnly ? <span className="ca-mp-logo__word">Mercado Pago</span> : null}
    </span>
  );
}
