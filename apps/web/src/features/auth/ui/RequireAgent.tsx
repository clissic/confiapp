import { Navigate, Outlet } from 'react-router-dom';
import { Spinner } from 'react-bootstrap';

import { useAgentOnboarding } from '@/features/agent-onboarding/hooks/useAgentOnboarding';

import { useAuth } from './AuthProvider';

/**
 * Exige agente registrado (ACTIVE o INACTIVE).
 * Si el usuario aún no completó el alta, redirige a /agente.
 */
export function RequireAgent() {
  const { user } = useAuth();
  const { data, isLoading, isError } = useAgentOnboarding();

  if (!user) {
    return <Navigate to="/ingresar" replace />;
  }

  if (isLoading) {
    return (
      <div className="d-flex justify-content-center align-items-center py-5" role="status">
        <Spinner animation="border" size="sm" className="me-2" />
        <span className="text-muted">Verificando agencia…</span>
      </div>
    );
  }

  const onboarding = data?.data;
  const isAgent =
    onboarding?.isAgent === true ||
    onboarding?.status === 'ACTIVE' ||
    onboarding?.status === 'INACTIVE';

  if (isError || !isAgent) {
    return <Navigate to="/agente" replace />;
  }

  return <Outlet />;
}
