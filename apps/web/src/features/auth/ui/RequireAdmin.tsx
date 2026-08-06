import { Navigate, Outlet } from 'react-router-dom';
import { Alert } from 'react-bootstrap';

import { useAuth } from './AuthProvider';

/** Exige rol ADMIN (después de RequireAuth). */
export function RequireAdmin() {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/ingresar" replace />;
  }

  if (user.role !== 'ADMIN') {
    return (
      <Alert variant="danger" className="m-3">
        No tenés permisos de administrador para ver esta página.
      </Alert>
    );
  }

  return <Outlet />;
}
