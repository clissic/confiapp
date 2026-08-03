import { NavLink } from 'react-router-dom';
import {
  BadgeCheck,
  BellRing,
  BriefcaseBusiness,
  CircleDollarSign,
  FileStack,
  Handshake,
  LayoutDashboard,
  MapPinned,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Scale,
  ScrollText,
  Settings,
  ShieldCheck,
  Award,
  UserRound,
  Wallet,
} from 'lucide-react';
import { motion } from 'framer-motion';

export interface SidebarProps {
  open: boolean;
  collapsed: boolean;
  onClose: () => void;
  onToggleCollapse: () => void;
}

const NAV_ITEMS = [
  { label: 'Inicio', icon: LayoutDashboard, to: '/inicio' as const },
  { label: 'Perfil', icon: UserRound, to: '/perfil' as const },
  { label: 'Ser agente', icon: BadgeCheck, to: '/agente' as const },
  { label: 'Trabajos abiertos', icon: BriefcaseBusiness, to: '/agente/trabajos' as const },
  { label: 'Buscar agentes', icon: MapPinned, to: '/agente/buscar' as const },
  { label: 'Ofertas agente', icon: BellRing, to: '/agente/ofertas' as const },
  { label: 'Operaciones', icon: Handshake, to: '/operaciones' as const },
  { label: 'Productos', icon: FileStack },
  { label: 'Pagos', icon: Wallet, to: '/pagos' as const },
  { label: 'Wallet', icon: CircleDollarSign, to: '/wallet' as const },
  { label: 'Reputación', icon: Award, to: '/reputacion' as const },
  { label: 'Auditoría', icon: ScrollText, to: '/auditoria' as const },
  { label: 'Disputas', icon: Scale },
  { label: 'Mensajes', icon: MessageSquare, to: '/mensajes' as const },
  { label: 'Configuración', icon: Settings, to: '/perfil' as const },
] as const;

const ROUTE_PREFETCH: Partial<Record<string, () => Promise<unknown>>> = {
  '/mensajes': () => import('@/pages/MessagesPage'),
  '/agente/trabajos': () => import('@/pages/OpenJobsPage'),
  '/agente/ofertas': () => import('@/pages/AgentOffersPage'),
  '/agente/buscar': () => import('@/pages/AgentSearchPage'),
  '/operaciones': () => import('@/pages/TransactionsPage'),
  '/wallet': () => import('@/pages/WalletPage'),
  '/reputacion': () => import('@/pages/ReputationPage'),
};

/** Navegación lateral. */
export function Sidebar({ open, collapsed, onClose, onToggleCollapse }: SidebarProps) {
  return (
    <aside
      className={[
        'ca-sidebar',
        open ? 'ca-sidebar--open' : '',
        collapsed ? 'ca-sidebar--collapsed' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label="Navegación principal"
    >
      <div className="ca-sidebar__brand">
        <div className="ca-sidebar__logo" aria-hidden>
          <ShieldCheck size={22} strokeWidth={1.75} />
        </div>
        {!collapsed ? (
          <motion.div
            className="ca-sidebar__brand-text"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.18 }}
          >
            <span className="ca-sidebar__name">ConfiApp</span>
            <span className="ca-sidebar__tag">Plataforma de confianza</span>
          </motion.div>
        ) : null}

        <button
          type="button"
          className="ca-sidebar__collapse d-none d-lg-inline-flex"
          aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
          onClick={onToggleCollapse}
        >
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>

      <nav className="ca-sidebar__nav">
        <p className="ca-sidebar__section">{collapsed ? '·' : 'Operación'}</p>
        <ul className="ca-sidebar__list">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            if (!('to' in item) || !item.to) {
              return (
                <li key={item.label}>
                  <span className="ca-sidebar__item ca-sidebar__item--disabled" title="Próximamente">
                    <Icon size={20} strokeWidth={1.75} />
                    {!collapsed ? <span>{item.label}</span> : null}
                  </span>
                </li>
              );
            }

            return (
              <li key={item.label}>
                <NavLink
                  to={item.to}
                  end={item.to === '/inicio'}
                  title={item.label}
                  className={({ isActive }) =>
                    `ca-sidebar__item ${isActive ? 'ca-sidebar__item--active' : ''}`
                  }
                  onMouseEnter={() => {
                    void ROUTE_PREFETCH[item.to]?.();
                  }}
                  onFocus={() => {
                    void ROUTE_PREFETCH[item.to]?.();
                  }}
                  onClick={onClose}
                >
                  {({ isActive }) => (
                    <>
                      {isActive ? <span className="ca-sidebar__active-bar" aria-hidden /> : null}
                      <Icon size={20} strokeWidth={1.75} />
                      {!collapsed ? <span>{item.label}</span> : null}
                    </>
                  )}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="ca-sidebar__footer">
        {!collapsed ? (
          <div className="ca-sidebar__trust">
            <ShieldCheck size={16} strokeWidth={1.75} />
            <span>Sesión protegida</span>
          </div>
        ) : (
          <ShieldCheck size={18} strokeWidth={1.75} aria-hidden />
        )}
        <button type="button" className="ca-sidebar__close d-lg-none" onClick={onClose}>
          Cerrar
        </button>
      </div>
    </aside>
  );
}
