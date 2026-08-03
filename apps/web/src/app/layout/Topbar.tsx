import { Bell, Menu, Moon, Sun } from 'lucide-react';

import type { LayoutTheme } from './useLayoutChrome';
import { UserMenu } from './UserMenu';

export interface TopbarProps {
  onMenuClick: () => void;
  theme: LayoutTheme;
  onToggleTheme: () => void;
}

/** Barra superior — estructura visual. */
export function Topbar({ onMenuClick, theme, onToggleTheme }: TopbarProps) {
  return (
    <header className="ca-topbar">
      <div className="ca-topbar__left">
        <button
          type="button"
          className="ca-icon-btn d-lg-none"
          aria-label="Abrir menú"
          onClick={onMenuClick}
        >
          <Menu size={20} strokeWidth={1.75} />
        </button>
        <div className="ca-topbar__title d-none d-sm-block">
          <p className="ca-topbar__eyebrow">Espacio de trabajo</p>
          <h1 className="ca-topbar__heading">Panel principal</h1>
        </div>
      </div>

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

        <button type="button" className="ca-icon-btn ca-icon-btn--badge" aria-label="Notificaciones">
          <Bell size={18} strokeWidth={1.75} />
          <span className="ca-icon-btn__dot" aria-hidden />
        </button>

        <UserMenu />
      </div>
    </header>
  );
}
