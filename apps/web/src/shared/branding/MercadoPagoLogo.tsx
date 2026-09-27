type MercadoPagoLogoProps = {
  className?: string;
  /** Ancho visual del lockup horizontal. */
  width?: number;
};

const COLOR_SRC = '/landing/MP_RGB_HANDSHAKE_color_horizontal.svg';
const PLUMA_SRC = '/landing/MP_RGB_HANDSHAKE_pluma_horizontal.svg';

/**
 * Logos oficiales Mercado Pago (pack RGB handshake horizontal).
 * - color → light mode
 * - pluma (blanco) → dark mode
 * Guía: https://www.mercadopago.com.ar/mp/logo-oficial
 */
export function MercadoPagoLogo({ className = '', width = 168 }: MercadoPagoLogoProps) {
  return (
    <span
      className={['ca-mp-logo', className].filter(Boolean).join(' ')}
      role="img"
      aria-label="Mercado Pago"
    >
      <img
        className="ca-mp-logo__img ca-mp-logo__img--color"
        src={COLOR_SRC}
        alt=""
        width={width}
        height={Math.round(width * 0.405)}
        decoding="async"
      />
      <img
        className="ca-mp-logo__img ca-mp-logo__img--pluma"
        src={PLUMA_SRC}
        alt=""
        width={width}
        height={Math.round(width * 0.405)}
        decoding="async"
      />
    </span>
  );
}
