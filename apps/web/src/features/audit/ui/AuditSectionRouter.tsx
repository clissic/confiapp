import { Navigate, useParams } from 'react-router-dom';

import { getAuditSection } from '../model/sections';
import { AuditSectionPage } from './AuditSectionPage';
import { FinancialAuditSectionPage } from './FinancialAuditSectionPage';

/** Enruta cada subsección de auditoría al componente correspondiente. */
export function AuditSectionRouter() {
  const { sectionId = '' } = useParams<{ sectionId: string }>();
  const section = getAuditSection(sectionId);

  if (!section) {
    return <Navigate to="/auditoria/acceso" replace />;
  }

  if (section.id === 'finanzas') {
    return <FinancialAuditSectionPage />;
  }

  return <AuditSectionPage />;
}
