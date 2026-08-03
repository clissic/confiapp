import { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Spinner } from 'react-bootstrap';

import { MainLayout } from '@/app/layout/MainLayout';
import { RequireAuth } from '@/features/auth/ui/RequireAuth';

const LandingPage = lazy(() =>
  import('@/pages/LandingPage').then((m) => ({ default: m.LandingPage })),
);
const LoginPage = lazy(() =>
  import('@/pages/LoginPage').then((m) => ({ default: m.LoginPage })),
);
const RegisterPage = lazy(() =>
  import('@/pages/RegisterPage').then((m) => ({ default: m.RegisterPage })),
);
const WorkspacePlaceholderPage = lazy(() =>
  import('@/pages/WorkspacePlaceholderPage').then((m) => ({
    default: m.WorkspacePlaceholderPage,
  })),
);
const ProfilePage = lazy(() =>
  import('@/pages/ProfilePage').then((m) => ({ default: m.ProfilePage })),
);
const BecomeAgentPage = lazy(() =>
  import('@/pages/BecomeAgentPage').then((m) => ({ default: m.BecomeAgentPage })),
);
const AgentSearchPage = lazy(() =>
  import('@/pages/AgentSearchPage').then((m) => ({ default: m.AgentSearchPage })),
);
const AgentOffersPage = lazy(() =>
  import('@/pages/AgentOffersPage').then((m) => ({ default: m.AgentOffersPage })),
);
const OpenJobsPage = lazy(() =>
  import('@/pages/OpenJobsPage').then((m) => ({ default: m.OpenJobsPage })),
);
const TransactionsPage = lazy(() =>
  import('@/pages/TransactionsPage').then((m) => ({ default: m.TransactionsPage })),
);
const StartTransactionHubPage = lazy(() =>
  import('@/pages/StartTransactionHubPage').then((m) => ({
    default: m.StartTransactionHubPage,
  })),
);
const StartTransactionPage = lazy(() =>
  import('@/pages/StartTransactionPage').then((m) => ({ default: m.StartTransactionPage })),
);
const StartSellerTransactionPage = lazy(() =>
  import('@/pages/StartSellerTransactionPage').then((m) => ({
    default: m.StartSellerTransactionPage,
  })),
);
const JoinTransactionPage = lazy(() =>
  import('@/pages/JoinTransactionPage').then((m) => ({ default: m.JoinTransactionPage })),
);
const TransactionDetailPage = lazy(() =>
  import('@/pages/TransactionDetailPage').then((m) => ({ default: m.TransactionDetailPage })),
);
const MessagesPage = lazy(() =>
  import('@/pages/MessagesPage').then((m) => ({ default: m.MessagesPage })),
);
const PaymentsPage = lazy(() =>
  import('@/pages/PaymentsPage').then((m) => ({ default: m.PaymentsPage })),
);
const WalletPage = lazy(() =>
  import('@/pages/WalletPage').then((m) => ({ default: m.WalletPage })),
);
const AuditPage = lazy(() =>
  import('@/pages/AuditPage').then((m) => ({ default: m.AuditPage })),
);
const ReputationPage = lazy(() =>
  import('@/pages/ReputationPage').then((m) => ({ default: m.ReputationPage })),
);

function RouteFallback() {
  return (
    <div className="d-flex justify-content-center align-items-center py-5" role="status">
      <Spinner animation="border" size="sm" className="me-2" />
      <span className="text-muted">Cargando…</span>
    </div>
  );
}

/** Router con code-splitting por ruta (React.lazy). */
export function AppRouter() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/ingresar" element={<LoginPage />} />
          <Route path="/registro" element={<RegisterPage />} />

          <Route element={<RequireAuth />}>
            <Route element={<MainLayout />}>
              <Route path="inicio" element={<WorkspacePlaceholderPage />} />
              <Route path="perfil" element={<ProfilePage />} />
              <Route path="profile" element={<Navigate to="/perfil" replace />} />
              <Route path="agente" element={<BecomeAgentPage />} />
              <Route path="agente/buscar" element={<AgentSearchPage />} />
              <Route path="agente/ofertas" element={<AgentOffersPage />} />
              <Route path="agente/trabajos" element={<OpenJobsPage />} />
              <Route path="become-agent" element={<Navigate to="/agente" replace />} />
              <Route path="operaciones" element={<TransactionsPage />} />
              <Route path="operaciones/nueva" element={<StartTransactionHubPage />} />
              <Route path="operaciones/nueva/comprador" element={<StartTransactionPage />} />
              <Route path="operaciones/nueva/vendedor" element={<StartSellerTransactionPage />} />
              <Route path="operaciones/unirse/:token" element={<JoinTransactionPage />} />
              <Route path="operaciones/:code" element={<TransactionDetailPage />} />
              <Route path="mensajes" element={<MessagesPage />} />
              <Route path="pagos" element={<PaymentsPage />} />
              <Route path="wallet" element={<WalletPage />} />
              <Route path="auditoria" element={<AuditPage />} />
              <Route path="reputacion" element={<ReputationPage />} />
              <Route path="*" element={<Navigate to="/inicio" replace />} />
            </Route>
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
