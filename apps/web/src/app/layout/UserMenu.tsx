import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, LogOut } from 'lucide-react';

import { VerifiedName } from '@/shared/ui/VerifiedName';

import { useAuth } from '@/features/auth/ui/AuthProvider';

import { USER_MENU_LINKS } from './nav-config';
import { useCompactTopbarMenus } from './useCompactTopbarMenus';

function initialsFromName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
}

function UserAvatar({
  fullName,
  avatar,
  className,
}: {
  fullName: string;
  avatar?: string;
  className?: string;
}) {
  const initials = useMemo(() => initialsFromName(fullName), [fullName]);
  return (
    <span className={`ca-avatar ${className ?? ''}`.trim()} aria-hidden>
      {avatar ? <img src={avatar} alt="" className="ca-avatar__img" /> : initials}
    </span>
  );
}

/** Menú anidado de cuenta (perfil, wallet, reputación). */
export function UserMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const compact = useCompactTopbarMenus();

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !compact) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, compact]);

  async function onLogout() {
    setOpen(false);
    await logout();
    navigate('/ingresar', { replace: true });
  }

  const menuLinks = useMemo(
    () =>
      USER_MENU_LINKS.filter(
        (item) => !item.adminOnly || user?.role === 'ADMIN',
      ),
    [user?.role],
  );

  return (
    <div className="ca-user-menu" ref={rootRef}>
      <button
        type="button"
        className="ca-user-menu__trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <UserAvatar fullName={user?.fullName ?? ''} avatar={user?.avatar} />
        <span className="ca-user-menu__meta d-none d-md-flex">
          <VerifiedName
            className="ca-user-menu__name"
            name={user?.fullName ?? 'Cuenta'}
            verified={Boolean(user?.identityVerified)}
          />
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
            initial={
              compact
                ? { opacity: 0, y: -10 }
                : { opacity: 0, y: -6, scale: 0.98 }
            }
            animate={compact ? { opacity: 1, y: 0 } : { opacity: 1, y: 0, scale: 1 }}
            exit={
              compact
                ? { opacity: 0, y: -8 }
                : { opacity: 0, y: -4, scale: 0.98 }
            }
            transition={{ duration: 0.18, ease: [0, 0, 0.2, 1] }}
          >
            <div className="ca-user-menu__header">
              <UserAvatar
                fullName={user?.fullName ?? ''}
                avatar={user?.avatar}
                className="ca-avatar--lg"
              />
              <div>
                <p className="ca-user-menu__name mb-0">{user?.fullName ?? 'Cuenta'}</p>
                <p className="ca-user-menu__email mb-0">{user?.email ?? ''}</p>
              </div>
            </div>
            <div className="ca-user-menu__sep" />
            <p className="ca-user-menu__section">Mi cuenta</p>
            {menuLinks.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.id}
                  to={item.to}
                  className="ca-user-menu__item"
                  role="menuitem"
                  onClick={() => setOpen(false)}
                >
                  <Icon size={16} strokeWidth={1.75} />
                  {item.label}
                </Link>
              );
            })}
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
