import { Link } from 'react-router-dom';
import { Facebook, Instagram } from 'lucide-react';

import { FACEBOOK_URL, INSTAGRAM_URL } from '@/shared/config/social';

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

        <nav className="ca-app-footer__social" aria-label="Redes sociales">
          <a
            className="ca-app-footer__social-link"
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram de ConfiApp"
          >
            <Instagram size={18} strokeWidth={1.75} aria-hidden />
          </a>
          {FACEBOOK_URL ? (
            <a
              className="ca-app-footer__social-link"
              href={FACEBOOK_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Facebook de ConfiApp"
            >
              <Facebook size={18} strokeWidth={1.75} aria-hidden />
            </a>
          ) : (
            <span
              className="ca-app-footer__social-link ca-app-footer__social-link--pending"
              title="Facebook próximamente"
              aria-label="Facebook de ConfiApp (próximamente)"
            >
              <Facebook size={18} strokeWidth={1.75} aria-hidden />
            </span>
          )}
        </nav>

        <p className="ca-app-footer__copy">© {new Date().getFullYear()} ConfiApp</p>
      </div>
    </footer>
  );
}
