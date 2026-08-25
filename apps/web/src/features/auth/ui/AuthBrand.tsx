import { Link } from 'react-router-dom';

/** Marca ConfiApp para pantallas públicas de auth (logo con contraste en fondo claro). */
export function AuthBrand() {
  return (
    <Link to="/" className="ca-auth__brand" aria-label="ConfiApp">
      <img
        className="ca-auth__brand-logo"
        src="/landing/ConfiApp-logo.png"
        alt=""
        width={36}
        height={36}
        decoding="async"
      />
      <span className="ca-auth__brand-name">
        <span className="ca-auth__brand-name--dark">Confi</span>
        <span className="ca-auth__brand-name--light">App</span>
      </span>
    </Link>
  );
}
