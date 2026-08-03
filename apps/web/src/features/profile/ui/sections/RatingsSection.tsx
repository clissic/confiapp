import { Star } from 'lucide-react';
import { Link } from 'react-router-dom';

import type { UserProfile } from '../../model/types';

export function RatingsSection({ profile }: { profile: UserProfile }) {
  const { rating, reputation, stats, roleRatings } = profile;
  const maxBar = Math.max(
    1,
    rating.distribution.one,
    rating.distribution.two,
    rating.distribution.three,
    rating.distribution.four,
    rating.distribution.five,
  );

  const bars = [
    { label: '5', value: rating.distribution.five },
    { label: '4', value: rating.distribution.four },
    { label: '3', value: rating.distribution.three },
    { label: '2', value: rating.distribution.two },
    { label: '1', value: rating.distribution.one },
  ];

  const roles = [
    { label: 'Comprador', data: roleRatings?.buyer },
    { label: 'Vendedor', data: roleRatings?.seller },
    { label: 'Agente', data: roleRatings?.agent },
  ];

  return (
    <section>
      <h3 className="ca-section-title">Calificaciones</h3>
      <p className="ca-section-lead">
        Reputación y distribución de reviews recibidas.{' '}
        <Link to="/reputacion">Ver desglose completo</Link>
      </p>

      <div className="ca-rating-hero">
        <div className="ca-rating-score">
          <Star size={28} className="ca-rating-score__icon" strokeWidth={1.75} />
          <div>
            <strong>{rating.average.toFixed(1)}</strong>
            <span>/ 5 · {rating.count} reseñas</span>
          </div>
        </div>
        <div className="ca-stat-row">
          <div className="ca-stat">
            <span className="ca-stat__label">Score reputación</span>
            <strong>{reputation.score}</strong>
          </div>
          <div className="ca-stat">
            <span className="ca-stat__label">Recibidas</span>
            <strong>{stats.reviewsReceived}</strong>
          </div>
          <div className="ca-stat">
            <span className="ca-stat__label">Otorgadas</span>
            <strong>{stats.reviewsGiven}</strong>
          </div>
          <div className="ca-stat">
            <span className="ca-stat__label">Completadas</span>
            <strong>{stats.completedTransactions}</strong>
          </div>
        </div>
      </div>

      <div className="ca-stat-row mb-3">
        {roles.map((role) => (
          <div key={role.label} className="ca-stat">
            <span className="ca-stat__label">{role.label}</span>
            <strong>
              {(role.data?.average ?? 0).toFixed(1)} · {role.data?.count ?? 0}
            </strong>
          </div>
        ))}
      </div>

      <div className="ca-rating-bars">
        {bars.map((bar) => (
          <div key={bar.label} className="ca-rating-bars__row">
            <span>{bar.label}★</span>
            <div className="ca-rating-bars__track">
              <div
                className="ca-rating-bars__fill"
                style={{ width: `${(bar.value / maxBar) * 100}%` }}
              />
            </div>
            <span>{bar.value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
