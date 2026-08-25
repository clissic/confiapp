import { Link, Outlet, useSearchParams } from 'react-router-dom';

import { useAuth } from '@/features/auth/ui/AuthProvider';
import { AuthBrand } from '@/features/auth/ui/AuthBrand';
import '@/features/auth/styles/auth.css';
import { MainLayout } from '@/app/layout/MainLayout';

import '../styles/legal.css';

function safeReturnPath(raw: string | null): string | null {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return null;
  return raw;
}

/** Shell mínimo para páginas legales cuando no hay sesión. */
function PublicLegalLayout() {
  const [params] = useSearchParams();
  const backTo = safeReturnPath(params.get('volver')) ?? '/';

  return (
    <div className="ca-legal-public" data-theme="light">
      <header className="ca-legal-public__top">
        <AuthBrand />
        <Link to={backTo} className="ca-legal-public__back">
          Volver
        </Link>
      </header>
      <main className="ca-legal-public__main">
        <div className="ca-legal-public__card">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

/**
 * Términos / privacidad / ayuda: con sesión usan el shell de la app;
 * sin sesión, una vista pública para poder leerlos desde el registro.
 */
export function LegalAccessLayout() {
  const { isAuthenticated, isBootstrapping } = useAuth();

  if (isBootstrapping) {
    return (
      <div
        className="ca-legal-public ca-legal-public--loading"
        data-theme="light"
        role="status"
      >
        <span className="text-muted">Cargando…</span>
      </div>
    );
  }

  if (isAuthenticated) {
    return <MainLayout />;
  }

  return <PublicLegalLayout />;
}
