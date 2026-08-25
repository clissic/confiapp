import { Link } from 'react-router-dom';

/** Footer mínimo del shell autenticado — solo desktop (≥ lg). */
export function AppFooter() {
  return (
    <footer className="ca-app-footer d-none d-lg-block" aria-label="Información legal">
      <div className="ca-app-footer__inner">
        <nav className="ca-app-footer__nav" aria-label="Legal y ayuda">
          <Link to="/terminos" className="ca-app-footer__link">
            Términos y Condiciones
          </Link>
          <span className="ca-app-footer__sep" aria-hidden>
            ·
          </span>
          <Link to="/privacidad" className="ca-app-footer__link">
            Privacidad
          </Link>
          <span className="ca-app-footer__sep" aria-hidden>
            ·
          </span>
          <Link to="/ayuda" className="ca-app-footer__link">
            Ayuda
          </Link>
        </nav>
        <p className="ca-app-footer__copy">© {new Date().getFullYear()} ConfiApp</p>
      </div>
    </footer>
  );
}
