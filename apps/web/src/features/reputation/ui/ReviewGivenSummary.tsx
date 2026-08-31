import { Star } from 'lucide-react';

import type { PartyRole, ReviewItem } from '../model/types';

const ROLE_LABEL: Record<PartyRole, string> = {
  BUYER: 'Comprador',
  SELLER: 'Vendedor',
  AGENT: 'Agente',
};

const ROLE_ORDER: Record<PartyRole, number> = {
  SELLER: 0,
  AGENT: 1,
  BUYER: 2,
};

function sortReviews(reviews: ReviewItem[]): ReviewItem[] {
  return [...reviews].sort(
    (a, b) => ROLE_ORDER[a.revieweeRole] - ROLE_ORDER[b.revieweeRole],
  );
}

function RatingStars({ rating }: { rating: number }) {
  return (
    <span className="ca-review-summary__stars" aria-label={`${rating} de 5`}>
      {Array.from({ length: 5 }, (_, index) => {
        const filled = index < rating;
        return (
          <Star
            key={index}
            size={16}
            strokeWidth={1.75}
            fill={filled ? 'currentColor' : 'none'}
            aria-hidden
          />
        );
      })}
    </span>
  );
}

type ReviewGivenSummaryProps = {
  reviews: ReviewItem[];
  compact?: boolean;
};

/** Resumen de calificaciones otorgadas en una operación. */
export function ReviewGivenSummary({ reviews, compact = false }: ReviewGivenSummaryProps) {
  if (!reviews.length) return null;

  const sorted = sortReviews(reviews);

  return (
    <div
      className={`ca-review-summary${compact ? ' ca-review-summary--compact' : ''}`}
      aria-label="Tus calificaciones en esta operación"
    >
      {!compact ? (
        <h3 className="ca-review-summary__title">Tus calificaciones</h3>
      ) : (
        <p className="ca-review-summary__kicker">Ya calificaste</p>
      )}

      <ul className="ca-review-summary__list">
        {sorted.map((review) => (
          <li key={review.id} className="ca-review-summary__item">
            <div className="ca-review-summary__row">
              <span className="ca-review-summary__role">{ROLE_LABEL[review.revieweeRole]}</span>
              <RatingStars rating={review.rating} />
            </div>
            {review.comment ? (
              <p className="ca-review-summary__comment">{review.comment}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
