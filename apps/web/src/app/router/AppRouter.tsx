import { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Spinner } from 'react-bootstrap';

import { MainLayout } from '@/app/layout/MainLayout';
import { RequireAdmin } from '@/features/auth/ui/RequireAdmin';
import { RequireAgent } from '@/features/auth/ui/RequireAgent';
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
const VerifyEmailPage = lazy(() =>
  import('@/pages/VerifyEmailPage').then((m) => ({ default: m.VerifyEmailPage })),
);
const WorkspacePlaceholderPage = lazy(() =>
  import('@/pages/WorkspacePlaceholderPage').then((m) => ({
    default: m.WorkspacePlaceholderPage,
  })),
);
const ProfilePage = lazy(() =>
  import('@/pages/ProfilePage').then((m) => ({ default: m.ProfilePage })),
);
const VerifyPhonePage = lazy(() =>
  import('@/pages/VerifyPhonePage').then((m) => ({ default: m.VerifyPhonePage })),
);
const BecomeAgentPage = lazy(() =>
  import('@/pages/BecomeAgentPage').then((m) => ({ default: m.BecomeAgentPage })),
);
const AgentSearchPage = lazy(() =>
  import('@/pages/AgentSearchPage').then((m) => ({ default: m.AgentSearchPage })),
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
const TransactionPayPage = lazy(() =>
  import('@/pages/TransactionPayPage').then((m) => ({ default: m.TransactionPayPage })),
);
const TransactionPayMockPage = lazy(() =>
  import('@/pages/TransactionPayMockPage').then((m) => ({ default: m.TransactionPayMockPage })),
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
const AuditSectionRouter = lazy(() =>
  import('@/pages/AuditPage').then((m) => ({ default: m.AuditSectionRouter })),
);
const ReputationPage = lazy(() =>
  import('@/pages/ReputationPage').then((m) => ({ default: m.ReputationPage })),
);
const AdminKycReviewPage = lazy(() =>
  import('@/pages/AdminKycReviewPage').then((m) => ({ default: m.AdminKycReviewPage })),
);
const AdminFinancePage = lazy(() =>
  import('@/pages/AdminFinancePage').then((m) => ({ default: m.AdminFinancePage })),
);
const AdminPaymentsPage = lazy(() =>
  import('@/pages/AdminPaymentsPage').then((m) => ({ default: m.AdminPaymentsPage })),
);
const NotificationsPage = lazy(() =>
  import('@/pages/NotificationsPage').then((m) => ({ default: m.NotificationsInboxPage })),
);
const TermsPage = lazy(() =>
  import('@/pages/TermsPage').then((m) => ({ default: m.TermsPage })),
);
const PrivacyPage = lazy(() =>
  import('@/pages/PrivacyPage').then((m) => ({ default: m.PrivacyPage })),
);
const HelpPage = lazy(() =>
  import('@/pages/HelpPage').then((m) => ({ default: m.HelpPage })),
);
const LegalAccessLayout = lazy(() =>
  import('@/features/legal/ui/LegalAccessLayout').then((m) => ({
    default: m.LegalAccessLayout,
  })),
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
          <Route path="/verificar-email" element={<VerifyEmailPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />

          <Route element={<LegalAccessLayout />}>
            <Route path="terminos" element={<TermsPage />} />
            <Route path="privacidad" element={<PrivacyPage />} />
            <Route path="ayuda" element={<HelpPage />} />
          </Route>

          <Route element={<RequireAuth />}>
            <Route element={<MainLayout />}>
              <Route path="inicio" element={<WorkspacePlaceholderPage />} />
              <Route path="perfil" element={<ProfilePage />} />
              <Route path="perfil/verificar-telefono" element={<VerifyPhonePage />} />
              <Route path="profile" element={<Navigate to="/perfil" replace />} />
              <Route path="agente" element={<BecomeAgentPage />} />
              <Route path="agente/buscar" element={<AgentSearchPage />} />
              <Route element={<RequireAgent />}>
                <Route path="agente/trabajos" element={<OpenJobsPage />} />
              </Route>
              <Route path="become-agent" element={<Navigate to="/agente" replace />} />
              <Route path="operaciones" element={<TransactionsPage />} />
              <Route path="operaciones/nueva" element={<StartTransactionHubPage />} />
              <Route path="operaciones/nueva/comprador" element={<StartTransactionPage />} />
              <Route path="operaciones/nueva/vendedor" element={<StartSellerTransactionPage />} />
              <Route path="operaciones/unirse/:token" element={<JoinTransactionPage />} />
              <Route path="operaciones/:code/pagar/simular" element={<TransactionPayMockPage />} />
              <Route path="operaciones/:code/pagar" element={<TransactionPayPage />} />
              <Route path="operaciones/:code" element={<TransactionDetailPage />} />
              <Route path="mensajes" element={<MessagesPage />} />
              <Route path="pagos" element={<PaymentsPage />} />
              <Route path="wallet" element={<WalletPage />} />
              <Route path="reputacion" element={<ReputationPage />} />
              <Route path="notificaciones" element={<NotificationsPage />} />
              <Route element={<RequireAdmin />}>
                <Route path="auditoria" element={<AuditPage />}>
                  <Route path=":sectionId" element={<AuditSectionRouter />} />
                </Route>
                <Route path="admin/finanzas" element={<AdminFinancePage />} />
                <Route path="admin/pagos" element={<AdminPaymentsPage />} />
                <Route path="admin/kyc/:token" element={<AdminKycReviewPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/inicio" replace />} />
            </Route>
          </Route>

          <Route path="/terminos-y-condiciones" element={<Navigate to="/terminos" replace />} />
          <Route path="/politica-de-privacidad" element={<Navigate to="/privacidad" replace />} />
          <Route path="/help" element={<Navigate to="/ayuda" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
