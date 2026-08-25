import './brand-logo.css';

const LOGO_DARK_BG = '/landing/ConfiApp-logo.png';
const LOGO_LIGHT_BG = '/landing/ConfiApp-logo-claro.png';

type BrandLogoProps = {
  className?: string;
  width?: number;
  height?: number;
};

/**
 * Logo de marca que cambia en modo oscuro (`data-theme="dark"` → logo claro).
 */
export function BrandLogo({ className = '', width = 36, height = 36 }: BrandLogoProps) {
  return (
    <span className={`ca-brand-logo ${className}`.trim()} aria-hidden>
      <img
        className="ca-brand-logo__img ca-brand-logo__img--light-theme"
        src={LOGO_DARK_BG}
        alt=""
        width={width}
        height={height}
        decoding="async"
      />
      <img
        className="ca-brand-logo__img ca-brand-logo__img--dark-theme"
        src={LOGO_LIGHT_BG}
        alt=""
        width={width}
        height={height}
        decoding="async"
      />
    </span>
  );
}
