import { Badge } from 'react-bootstrap';
import { History } from 'lucide-react';

import type { UserProfile } from '../../model/types';

const TYPE_VARIANT: Record<string, string> = {
  COMPLETED: 'success',
  CANCELLED: 'secondary',
  DISPUTED: 'danger',
  REVIEW: 'info',
  PAYMENT: 'primary',
};

export function HistorySection({ profile }: { profile: UserProfile }) {
  return (
    <section>
      <h3 className="ca-section-title">Historial</h3>
      <p className="ca-section-lead">
        Actividad reciente: operaciones, pagos y calificaciones.
      </p>

      <div className="ca-stat-row mb-4">
        <div className="ca-stat">
          <span className="ca-stat__label">Completadas</span>
          <strong>{profile.stats.completedTransactions}</strong>
        </div>
        <div className="ca-stat">
          <span className="ca-stat__label">Canceladas</span>
          <strong>{profile.stats.cancelledTransactions}</strong>
        </div>
        <div className="ca-stat">
          <span className="ca-stat__label">Disputas</span>
          <strong>{profile.stats.disputedTransactions}</strong>
        </div>
        <div className="ca-stat">
          <span className="ca-stat__label">Éxito</span>
          <strong>{profile.stats.successRate}%</strong>
        </div>
      </div>

      {profile.history.length === 0 ? (
        <div className="ca-empty">
          <History size={22} />
          <p className="mb-0">Todavía no hay actividad para mostrar.</p>
        </div>
      ) : (
        <ul className="ca-timeline">
          {profile.history.map((item) => (
            <li key={item.id} className="ca-timeline__item">
              <div className="ca-timeline__top">
                <Badge bg={TYPE_VARIANT[item.type] ?? 'secondary'}>{item.type}</Badge>
                <time dateTime={item.occurredAt}>
                  {new Date(item.occurredAt).toLocaleString('es-AR')}
                </time>
              </div>
              <p className="ca-timeline__title">{item.title}</p>
              {item.meta ? <p className="ca-timeline__meta">{item.meta}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
