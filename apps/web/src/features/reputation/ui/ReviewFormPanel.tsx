import { useState } from 'react';
import { Alert, Button, Form, Spinner } from 'react-bootstrap';

import { useAppToast } from '@/shared/ui';

import { useCreateReview, usePendingTargets } from '../hooks/useReputation';
import type { PartyRole } from '../model/types';

const ROLE_LABEL: Record<PartyRole, string> = {
  BUYER: 'Comprador',
  SELLER: 'Vendedor',
  AGENT: 'Agente',
};

interface ReviewFormPanelProps {
  transactionCode: string;
}

/** Formulario post-COMPLETED para calificar contraparte / agente. */
export function ReviewFormPanel({ transactionCode }: ReviewFormPanelProps) {
  const toast = useAppToast();
  const pending = usePendingTargets(transactionCode);
  const create = useCreateReview();
  const [revieweeId, setRevieweeId] = useState('');
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (pending.isLoading) {
    return (
      <div className="d-flex align-items-center gap-2">
        <Spinner animation="border" size="sm" />
        <span>Cargando destinos de calificación…</span>
      </div>
    );
  }

  if (pending.isError || !pending.data) {
    return null;
  }

  const openTargets = pending.data.targets.filter((t) => !t.alreadyReviewed);
  if (!openTargets.length) {
    return (
      <Alert variant="secondary" className="mb-0">
        Ya calificaste a todos los participantes disponibles de esta operación.
      </Alert>
    );
  }

  const selected = revieweeId || openTargets[0]!.userId;

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
      toast.success('Calificación enviada. La reputación se actualizó con ponderación anti-fraude.');
      setComment('');
      setRating(5);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar la reseña');
    }
  };

  return (
    <section className="ca-tx-panel">
      <h3 className="ca-section-title">Calificar participantes</h3>
      <p className="ca-section-lead">
        Tu rol: <strong>{ROLE_LABEL[pending.data.myRole]}</strong>. Plazo:{' '}
        {pending.data.windowDays} días desde el cierre.
      </p>
      {error ? <Alert variant="danger">{error}</Alert> : null}
      <Form onSubmit={(e) => void onSubmit(e)} className="d-grid gap-3">
        <Form.Group>
          <Form.Label>A quién</Form.Label>
          <Form.Select
            value={selected}
            onChange={(e) => setRevieweeId(e.target.value)}
            required
          >
            {openTargets.map((t) => (
              <option key={t.userId} value={t.userId}>
                {ROLE_LABEL[t.role]} · {t.userId.slice(-6)}
              </option>
            ))}
          </Form.Select>
        </Form.Group>
        <Form.Group>
          <Form.Label>Puntaje ({rating}/5)</Form.Label>
          <Form.Range
            min={1}
            max={5}
            step={1}
            value={rating}
            onChange={(e) => setRating(Number(e.target.value))}
          />
        </Form.Group>
        <Form.Group>
          <Form.Label>Comentario (opcional)</Form.Label>
          <Form.Control
            as="textarea"
            rows={3}
            maxLength={2000}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Contá cómo fue la operación…"
          />
        </Form.Group>
        <div>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? 'Enviando…' : 'Enviar calificación'}
          </Button>
        </div>
      </Form>
    </section>
  );
}
