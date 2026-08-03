import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Spinner } from 'react-bootstrap';

import { useAuth } from './AuthProvider';

/** Exige sesión; si no hay token, redirige a /ingresar. */
export function RequireAuth() {
  const { isAuthenticated, isBootstrapping } = useAuth();
  const location = useLocation();

  if (isBootstrapping) {
    return (
      <div className="d-flex justify-content-center align-items-center min-vh-100" role="status">
        <Spinner animation="border" size="sm" className="me-2" />
        <span className="text-muted">Cargando sesión…</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`/ingresar?next=${encodeURIComponent(next)}`} replace />;
  }

  return <Outlet />;
}
