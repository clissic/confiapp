import { Link } from 'react-router-dom';
import { Moon, Sun } from 'lucide-react';

import { NotificationsMenu } from '@/features/notifications/ui/NotificationsMenu';
import type { ResolvedTheme } from '@/shared/preferences';
import { UserMenu } from './UserMenu';

export interface TopbarProps {
  theme: ResolvedTheme;
  onToggleTheme: () => void;
}

/** Header tipo marketplace: logo + acciones de cuenta. */
export function Topbar({ theme, onToggleTheme }: TopbarProps) {
  return (
    <header className="ca-topbar">
      <Link to="/inicio" className="ca-topbar__brand" aria-label="ConfiApp — Inicio">
        <img
          className="ca-topbar__logo"
          src="/landing/ConfiApp-logo.png"
          alt=""
          width={36}
          height={36}
        />
        <span className="ca-topbar__brand-name">
          <span className="ca-topbar__brand-name--dark">Confi</span>
          <span className="ca-topbar__brand-name--accent">App</span>
        </span>
      </Link>

      <div className="ca-topbar__right">
        <button
          type="button"
          className="ca-icon-btn"
          aria-label={theme === 'light' ? 'Activar modo oscuro' : 'Activar modo claro'}
          onClick={onToggleTheme}
        >
          {theme === 'light' ? (
            <Moon size={18} strokeWidth={1.75} />
          ) : (
            <Sun size={18} strokeWidth={1.75} />
          )}
        </button>

        <NotificationsMenu />

        <UserMenu />
      </div>
    </header>
  );
}
