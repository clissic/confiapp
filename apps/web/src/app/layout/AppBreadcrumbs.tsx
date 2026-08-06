import { Link, useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

/** Breadcrumbs según ruta actual. */
export function AppBreadcrumbs() {
  const { pathname } = useLocation();

  const crumbs = pathname.startsWith('/perfil')
    ? [
        { label: 'Inicio', to: '/inicio' },
        { label: 'Perfil', current: true as const },
      ]
    : pathname.startsWith('/agente')
      ? [
          { label: 'Inicio', to: '/inicio' },
          pathname === '/agente'
            ? { label: 'Ser agente', current: true as const }
            : { label: 'Agente', to: '/agente' },
          ...(pathname === '/agente/buscar'
            ? [{ label: 'Buscar', current: true as const }]
            : pathname === '/agente/ofertas'
              ? [{ label: 'Ofertas', current: true as const }]
              : pathname === '/agente/trabajos'
                ? [{ label: 'Trabajos', current: true as const }]
                : []),
        ]
      : pathname.startsWith('/operaciones')
        ? [
            { label: 'Inicio', to: '/inicio' },
            pathname === '/operaciones'
              ? { label: 'Operaciones', current: true as const }
              : { label: 'Operaciones', to: '/operaciones' },
            ...(pathname === '/operaciones/nueva'
              ? [{ label: 'Nueva', current: true as const }]
              : pathname === '/operaciones/nueva/comprador'
                ? [
                    { label: 'Nueva', to: '/operaciones/nueva' },
                    { label: 'Comprador', current: true as const },
                  ]
                : pathname === '/operaciones/nueva/vendedor'
                  ? [
                      { label: 'Nueva', to: '/operaciones/nueva' },
                      { label: 'Vendedor', current: true as const },
                    ]
                  : pathname.startsWith('/operaciones/unirse/')
                    ? [{ label: 'Unirse', current: true as const }]
                    : pathname !== '/operaciones'
                      ? [{ label: 'Detalle', current: true as const }]
                      : []),
          ]
        : pathname.startsWith('/mensajes')
          ? [
              { label: 'Inicio', to: '/inicio' },
              { label: 'Mensajes', current: true as const },
            ]
          : pathname.startsWith('/pagos')
            ? [
                { label: 'Inicio', to: '/inicio' },
                { label: 'Pagos', current: true as const },
              ]
            : pathname.startsWith('/wallet')
              ? [
                  { label: 'Inicio', to: '/inicio' },
                  { label: 'Wallet', current: true as const },
                ]
              : pathname.startsWith('/auditoria')
                ? [
                    { label: 'Inicio', to: '/inicio' },
                    { label: 'Auditoría', current: true as const },
                  ]
                : pathname.startsWith('/reputacion')
                  ? [
                      { label: 'Inicio', to: '/inicio' },
                      { label: 'Reputación', current: true as const },
                    ]
                  : pathname.startsWith('/notificaciones')
                    ? [
                        { label: 'Inicio', to: '/inicio' },
                        { label: 'Notificaciones', current: true as const },
                      ]
                    : [{ label: 'Inicio', current: true as const }];
  return (
    <nav className="ca-breadcrumbs" aria-label="Miga de pan">
      <ol className="ca-breadcrumbs__list">
        {crumbs.map((crumb, index) => (
          <li key={crumb.label} className="ca-breadcrumbs__item">
            {index > 0 ? (
              <ChevronRight
                className="ca-breadcrumbs__sep"
                size={14}
                strokeWidth={1.75}
                aria-hidden
              />
            ) : null}
            {'current' in crumb && crumb.current ? (
              <span className="ca-breadcrumbs__current" aria-current="page">
                {crumb.label}
              </span>
            ) : (
              <Link to={'to' in crumb ? crumb.to : '/inicio'} className="ca-breadcrumbs__link">
                {crumb.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
