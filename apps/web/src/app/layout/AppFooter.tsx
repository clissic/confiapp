/** Footer mínimo del shell autenticado — solo desktop (≥ lg). Links placeholder. */
export function AppFooter() {
  return (
    <footer className="ca-app-footer d-none d-lg-block" aria-label="Información legal">
      <div className="ca-app-footer__inner">
        <nav className="ca-app-footer__nav" aria-label="Legal y ayuda">
          <button type="button" className="ca-app-footer__link">
            Términos y Condiciones
          </button>
          <span className="ca-app-footer__sep" aria-hidden>
            ·
          </span>
          <button type="button" className="ca-app-footer__link">
            Privacidad
          </button>
          <span className="ca-app-footer__sep" aria-hidden>
            ·
          </span>
          <button type="button" className="ca-app-footer__link">
            Ayuda
          </button>
        </nav>
        <p className="ca-app-footer__copy">© {new Date().getFullYear()} ConfiApp</p>
      </div>
    </footer>
  );
}
