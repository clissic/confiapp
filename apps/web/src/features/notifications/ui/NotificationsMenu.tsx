import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell } from 'lucide-react';

import { notificationHref } from '@/features/notifications/api/notifications.api';
import {
  useMarkNotificationRead,
  useNotificationsPreview,
  useUnreadNotificationsCount,
} from '@/features/notifications/hooks/useNotifications';
import { useNotificationsRealtime } from '@/features/notifications/hooks/useNotificationsRealtime';
import { formatDateTime } from '@/shared/lib/money';
import { useCompactTopbarMenus } from '@/app/layout/useCompactTopbarMenus';

/** Campana del topbar: desplegable estilo menú de cuenta + link a /notificaciones. */
export function NotificationsMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const compact = useCompactTopbarMenus();
  useNotificationsRealtime();
  const { data: unread = 0 } = useUnreadNotificationsCount();
  const { data, isLoading, isError } = useNotificationsPreview();
  const markRead = useMarkNotificationRead();

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

  const items = data?.items ?? [];

  return (
    <div className="ca-notif-menu" ref={rootRef}>
      <button
        type="button"
        className={`ca-icon-btn${unread > 0 ? ' ca-icon-btn--badge' : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={
          unread > 0
            ? `Notificaciones, ${unread} sin leer`
            : 'Notificaciones'
        }
        onClick={() => setOpen((value) => !value)}
      >
        <Bell size={18} strokeWidth={1.75} />
        {unread > 0 ? (
          <span className="ca-icon-btn__count" aria-hidden>
            {unread > 99 ? '99+' : unread}
          </span>
        ) : null}
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            className="ca-notif-menu__dropdown"
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
            <div className="ca-notif-menu__header">
              <p className="ca-notif-menu__title mb-0">Notificaciones</p>
              {unread > 0 ? (
                <span className="ca-notif-menu__badge">{unread} nuevas</span>
              ) : null}
            </div>
            <div className="ca-user-menu__sep" />

            {isLoading ? (
              <p className="ca-notif-menu__empty">Cargando…</p>
            ) : isError ? (
              <p className="ca-notif-menu__empty ca-notif-menu__empty--error">
                No se pudieron cargar las notificaciones.
              </p>
            ) : items.length === 0 ? (
              <p className="ca-notif-menu__empty">No tenés notificaciones todavía.</p>
            ) : (
              <ul className="ca-notif-menu__list">
                {items.map((n) => {
                  const href = notificationHref(n);
                  const unreadItem = !n.readAt;
                  const content = (
                    <>
                      <span className="ca-notif-menu__item-title">
                        {unreadItem ? <span className="ca-notif-menu__dot" aria-hidden /> : null}
                        {n.title}
                      </span>
                      <span className="ca-notif-menu__item-body">{n.body}</span>
                      <time className="ca-notif-menu__item-time" dateTime={n.createdAt}>
                        {formatDateTime(n.createdAt)}
                      </time>
                    </>
                  );

                  if (href) {
                    return (
                      <li key={n.id}>
                        <Link
                          to={href}
                          className={`ca-notif-menu__item${unreadItem ? ' ca-notif-menu__item--unread' : ''}`}
                          role="menuitem"
                          onClick={() => {
                            setOpen(false);
                            if (unreadItem) void markRead.mutateAsync(n.id);
                          }}
                        >
                          {content}
                        </Link>
                      </li>
                    );
                  }

                  return (
                    <li key={n.id}>
                      <button
                        type="button"
                        className={`ca-notif-menu__item${unreadItem ? ' ca-notif-menu__item--unread' : ''}`}
                        role="menuitem"
                        onClick={() => {
                          if (unreadItem) void markRead.mutateAsync(n.id);
                        }}
                      >
                        {content}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="ca-user-menu__sep" />
            <Link
              to="/notificaciones"
              className="ca-user-menu__item ca-notif-menu__more"
              role="menuitem"
              onClick={() => setOpen(false)}
            >
              Ver más
            </Link>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
