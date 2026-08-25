import { NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';

import { AUDIT_SECTIONS } from '../model/sections';
import '../styles/audit.css';

/** Layout de auditoría con submenú por tipo de registro. */
export function AuditLayout() {
  const { pathname } = useLocation();
  const isIndex = pathname === '/auditoria' || pathname === '/auditoria/';

  if (isIndex) {
    return <Navigate to="/auditoria/acceso" replace />;
  }

  return (
    <div className="ca-audit">
      <header className="ca-audit__header">
        <div>
          <p className="ca-audit__kicker">Administración</p>
          <h1 className="ca-audit__title">Auditoría</h1>
          <p className="ca-audit__lead">
            Registro inmutable de actividad en la plataforma. Elegí una categoría para revisar
            accesos, operaciones, pagos, agentes, comunicación o finanzas.
          </p>
        </div>
      </header>

      <nav className="ca-audit-subnav" aria-label="Categorías de auditoría">
        <ul className="ca-audit-subnav__list">
          {AUDIT_SECTIONS.map((section) => (
            <li key={section.id}>
              <NavLink
                to={`/auditoria/${section.path}`}
                className={({ isActive }) =>
                  `ca-audit-subnav__link${isActive ? ' ca-audit-subnav__link--active' : ''}`
                }
              >
                {section.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <Outlet />
    </div>
  );
}
