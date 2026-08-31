import { useState } from 'react';
import { Button, Spinner } from 'react-bootstrap';
import { ShieldCheck, ShoppingBag, Store } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { useAppToast } from '@/shared/ui';

import {
  useCreateReview,
  usePendingTargets,
  useTransactionReviewsGiven,
} from '../hooks/useReputation';
import type { PartyRole } from '../model/types';
import { ReviewGivenSummary } from './ReviewGivenSummary';
import { StarRatingInput } from './StarRatingInput';
import '../styles/reputation.css';

const ROLE_META: Record<PartyRole, { label: string; Icon: LucideIcon }> = {
  BUYER: { label: 'Comprador', Icon: ShoppingBag },
  SELLER: { label: 'Vendedor', Icon: Store },
  AGENT: { label: 'Agente', Icon: ShieldCheck },
};

interface ReviewFormPanelProps {
  transactionCode: string;
}

/** Formulario post-COMPLETED para calificar contraparte / agente. */
export function ReviewFormPanel({ transactionCode }: ReviewFormPanelProps) {
  const toast = useAppToast();
  const pending = usePendingTargets(transactionCode);
  const given = useTransactionReviewsGiven(transactionCode);
  const create = useCreateReview();
  const [revieweeId, setRevieweeId] = useState('');
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loading = pending.isLoading || given.isLoading;

  if (loading) {
    return (
      <div className="ca-review-form ca-review-form--loading">
        <Spinner animation="border" size="sm" />
      </div>
    );
  }

  if (pending.isError || !pending.data) {
    return null;
  }

  const openTargets = pending.data.targets.filter((t) => !t.alreadyReviewed);
  const givenReviews = given.data ?? [];
  const hasOpen = openTargets.length > 0;
  const allReviewed = !hasOpen && givenReviews.length > 0;

  if (!hasOpen && !givenReviews.length) {
    return null;
  }

  if (allReviewed) {
    return (
      <section className="ca-review-form ca-review-form--summary">
        <ReviewGivenSummary reviews={givenReviews} />
      </section>
    );
  }

  const selected = revieweeId || openTargets[0]!.userId;
  const showTargetPicker = openTargets.length > 1;
  const soloTarget = openTargets[0]!;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await create.mutateAsync({
        transactionCode,
        revieweeId: selected,
        rating,
        comment: comment.trim() || undefined,
      });
      toast.success('Calificación enviada.');
      setComment('');
      setRating(5);
      setRevieweeId('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar la reseña');
    }
  };

  return (
    <section className="ca-review-form" aria-labelledby={`review-form-${transactionCode}`}>
      {givenReviews.length > 0 ? (
        <ReviewGivenSummary reviews={givenReviews} compact />
      ) : null}

      <div className="ca-review-form__head">
        <h3 className="ca-review-form__title" id={`review-form-${transactionCode}`}>
          Calificar
        </h3>

        {showTargetPicker ? (
          <div className="ca-review-form__segments" role="radiogroup" aria-label="A quién calificás">
            {openTargets.map((target) => {
              const meta = ROLE_META[target.role];
              const active = selected === target.userId;
              return (
                <button
                  key={target.userId}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  className={`ca-review-form__segment${active ? ' is-active' : ''}`}
                  onClick={() => setRevieweeId(target.userId)}
                >
                  <meta.Icon size={15} strokeWidth={1.75} aria-hidden />
                  <span>{meta.label}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <span className="ca-review-form__badge">
            {(() => {
              const Icon = ROLE_META[soloTarget.role].Icon;
              return <Icon size={14} strokeWidth={1.75} aria-hidden />;
            })()}
            {ROLE_META[soloTarget.role].label}
          </span>
        )}
      </div>

      <form onSubmit={(e) => void onSubmit(e)} className="ca-review-form__body">
        <StarRatingInput
          value={rating}
          onChange={setRating}
          disabled={create.isPending}
          size={36}
        />

        <textarea
          rows={2}
          maxLength={2000}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Comentario opcional…"
          className="ca-review-form__comment"
          disabled={create.isPending}
        />

        {error ? (
          <p className="ca-review-form__error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="ca-review-form__actions">
          <Button
            type="submit"
            size="sm"
            className="ca-btn-cta ca-review-form__submit"
            disabled={create.isPending}
          >
            {create.isPending ? 'Enviando…' : 'Enviar calificación'}
          </Button>
        </div>
      </form>
    </section>
  );
}
