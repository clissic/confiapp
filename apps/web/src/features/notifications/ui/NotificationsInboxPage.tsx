import { Link } from 'react-router-dom';
import { Alert, Badge, Button, Spinner } from 'react-bootstrap';
import { motion } from 'framer-motion';
import { Bell, CheckCheck } from 'lucide-react';

import { formatDateTime } from '@/shared/lib/money';

import { notificationHref } from '../api/notifications.api';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotificationsList,
} from '../hooks/useNotifications';
import { useNotificationsRealtime } from '../hooks/useNotificationsRealtime';
import '../styles/notifications.css';

const TYPE_LABELS: Record<string, string> = {
  MESSAGE: 'Mensaje',
  AGENT_ASSIGNMENT: 'Agente',
  TRANSACTION_UPDATE: 'Operación',
  PAYMENT: 'Pago',
  DISPUTE: 'Disputa',
  REVIEW: 'Reseña',
  SYSTEM: 'Sistema',
};

export function NotificationsInboxPage() {
  useNotificationsRealtime();
  const { data, isLoading, isError } = useNotificationsList();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  if (isLoading) {
    return (
      <div
        className="ca-notifications d-flex align-items-center justify-content-center gap-2"
        style={{ minHeight: 'min(52vh, 28rem)' }}
        role="status"
      >
        <Spinner animation="border" size="sm" />
        Cargando notificaciones…
      </div>
    );
  }

  if (isError) {
    return <Alert variant="danger">No se pudieron cargar las notificaciones.</Alert>;
  }

  const items = data?.items ?? [];
  const unread = data?.unreadCount ?? 0;

  return (
    <div className="ca-notifications">
      <header className="ca-notifications__header">
        <div>
          <h1 className="ca-notifications__title">Notificaciones</h1>
          <p className="ca-notifications__lead">
            {unread > 0
              ? `${unread} sin leer`
              : items.length > 0
                ? 'Todo al día'
                : 'Acá van a aparecer alertas de mensajes, pagos y operaciones'}
          </p>
        </div>
        {unread > 0 ? (
          <Button
            variant="outline-secondary"
            size="sm"
            disabled={markAll.isPending}
            onClick={() => void markAll.mutateAsync()}
          >
            <CheckCheck size={16} className="me-1" />
            Marcar todas leídas
          </Button>
        ) : null}
      </header>

      {items.length === 0 ? (
        <div className="ca-notifications__empty">
          <Bell size={32} strokeWidth={1.5} />
          <p className="mb-0">No tenés notificaciones todavía.</p>
        </div>
      ) : (
        <ul className="ca-notifications__list">
          {items.map((n, index) => {
            const unreadItem = !n.readAt;
            const href = notificationHref(n);
            return (
              <motion.li
                key={n.id}
                className={`ca-notifications__item${unreadItem ? ' ca-notifications__item--unread' : ''}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.03, 0.24) }}
              >
                <div className="ca-notifications__main">
                  <div className="ca-notifications__row">
                    <div className="ca-notifications__heading">
                      {unreadItem ? (
                        <span className="ca-notifications__dot" aria-hidden />
                      ) : null}
                      <p className="ca-notifications__title-text">{n.title}</p>
                    </div>
                  </div>
                  <p className="ca-notifications__body">{n.body}</p>
                </div>

                <div className="ca-notifications__aside">
                  <Badge bg="secondary" pill className="ca-notifications__type">
                    {TYPE_LABELS[n.type] ?? n.type}
                  </Badge>
                  <div className="ca-notifications__footer">
                    <time className="ca-notifications__time" dateTime={n.createdAt}>
                      {formatDateTime(n.createdAt)}
                    </time>
                    <div className="ca-notifications__actions">
                      {href ? (
                        <Link
                          to={href}
                          className="ca-notifications__link"
                          onClick={() => {
                            if (unreadItem) void markRead.mutateAsync(n.id);
                          }}
                        >
                          Abrir
                        </Link>
                      ) : null}
                      {unreadItem ? (
                        <button
                          type="button"
                          className="ca-notifications__mark"
                          disabled={markRead.isPending}
                          onClick={() => void markRead.mutateAsync(n.id)}
                        >
                          Marcar leída
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </motion.li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
