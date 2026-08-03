import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, LogOut, Settings, UserRound } from 'lucide-react';

import { useAuth } from '@/features/auth/ui/AuthProvider';

function initialsFromName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
}

/** Menú de usuario autenticado. */
export function UserMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const initials = useMemo(() => initialsFromName(user?.fullName ?? ''), [user?.fullName]);
  const roleLabel = user?.role === 'ADMIN' ? 'Admin' : 'Usuario';

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  async function onLogout() {
    setOpen(false);
    await logout();
    navigate('/ingresar', { replace: true });
  }

  return (
    <div className="ca-user-menu" ref={rootRef}>
      <button
        type="button"
        className="ca-user-menu__trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="ca-avatar" aria-hidden>
          {initials}
        </span>
        <span className="ca-user-menu__meta d-none d-md-flex">
          <span className="ca-user-menu__name">{user?.fullName ?? 'Cuenta'}</span>
          <span className="ca-user-menu__role">{roleLabel}</span>
        </span>
        <ChevronDown
          size={16}
          strokeWidth={1.75}
          className={`ca-user-menu__chevron ${open ? 'ca-user-menu__chevron--open' : ''}`}
        />
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            className="ca-user-menu__dropdown"
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0, 0, 0.2, 1] }}
          >
            <div className="ca-user-menu__header">
              <span className="ca-avatar ca-avatar--lg" aria-hidden>
                {initials}
              </span>
              <div>
                <p className="ca-user-menu__name mb-0">{user?.fullName ?? 'Cuenta'}</p>
                <p className="ca-user-menu__email mb-0">{user?.email ?? ''}</p>
              </div>
            </div>
            <div className="ca-user-menu__sep" />
            <Link
              to="/perfil"
              className="ca-user-menu__item"
              role="menuitem"
              onClick={() => setOpen(false)}
            >
              <UserRound size={16} strokeWidth={1.75} />
              Mi perfil
            </Link>
            <Link
              to="/perfil"
              className="ca-user-menu__item"
              role="menuitem"
              onClick={() => setOpen(false)}
            >
              <Settings size={16} strokeWidth={1.75} />
              Preferencias
            </Link>
            <div className="ca-user-menu__sep" />
            <button
              type="button"
              className="ca-user-menu__item ca-user-menu__item--muted"
              role="menuitem"
              onClick={() => void onLogout()}
            >
              <LogOut size={16} strokeWidth={1.75} />
              Cerrar sesión
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
