import { Alert, Badge, Button, Form, Spinner } from 'react-bootstrap';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { BadgeCheck, ShieldAlert } from 'lucide-react';

import { apiClient } from '@/shared/api/client';
import { useAuth } from '@/features/auth/ui/AuthProvider';
import { useAppToast } from '@/shared/ui';

import './admin-kyc.css';

type KycReviewDto = {
  userId: string;
  fullName: string;
  email: string;
  documentNumber?: string;
  status?: string;
  photos: Array<{ kind: string; url: string; uploadedAt: string }>;
  submittedAt?: string;
};

const KIND_LABEL: Record<string, string> = {
  ID_FRONT: 'DNI frente / Pasaporte',
  ID_BACK: 'DNI dorso',
  SELFIE: 'Selfie',
};

async function fetchKycReview(token: string): Promise<KycReviewDto> {
  const { data } = await apiClient.get<KycReviewDto>(`/users/kyc-reviews/${token}`);
  return data;
}

async function decideKycReview(
  token: string,
  body: { action: 'approve' | 'reject'; reason?: string },
) {
  const { data } = await apiClient.post(`/users/kyc-reviews/${token}/decide`, body);
  return data;
}

/** Revisión KYC — solo ADMIN. */
export function AdminKycReviewPage() {
  const { token = '' } = useParams<{ token: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const [reason, setReason] = useState('');

  const review = useQuery({
    queryKey: ['kyc-review', token],
    queryFn: () => fetchKycReview(token),
    enabled: Boolean(token) && user?.role === 'ADMIN',
    retry: false,
  });

  const decide = useMutation({
    mutationFn: (action: 'approve' | 'reject') =>
      decideKycReview(token, {
        action,
        reason: action === 'reject' ? reason : undefined,
      }),
    onSuccess: (_data, action) => {
      toast.success(action === 'approve' ? 'Identidad verificada.' : 'Solicitud rechazada.');
      queryClient.setQueryData<KycReviewDto>(['kyc-review', token], (current) =>
        current
          ? {
              ...current,
              status: action === 'approve' ? 'VERIFIED' : 'REJECTED',
            }
          : current,
      );
    },
  });

  if (user?.role !== 'ADMIN') {
    return (
      <Alert variant="danger" className="ca-admin-kyc__alert">
        <ShieldAlert size={18} className="me-2" aria-hidden />
        Solo los administradores pueden acceder a esta revisión.
      </Alert>
    );
  }

  if (review.isLoading) {
    return (
      <div className="ca-admin-kyc ca-admin-kyc--loading">
        <Spinner animation="border" size="sm" />
        <span>Cargando solicitud…</span>
      </div>
    );
  }

  if (review.isError || !review.data) {
    return (
      <Alert variant="danger" className="ca-admin-kyc__alert">
        No se encontró la solicitud o el enlace expiró.
      </Alert>
    );
  }

  const data = review.data;
  const pending = data.status === 'PENDING';
  const verified = data.status === 'VERIFIED';

  return (
    <div className="ca-admin-kyc">
      <header className="ca-admin-kyc__header">
        <div>
          <p className="ca-admin-kyc__kicker">Administración</p>
          <h2 className="ca-admin-kyc__title">
            <BadgeCheck size={26} strokeWidth={1.75} className="me-2" aria-hidden />
            Verificar identidad
          </h2>
        </div>
        <Badge bg={verified ? 'success' : pending ? 'warning' : 'secondary'}>
          {data.status ?? '—'}
        </Badge>
      </header>

      {decide.isError ? <Alert variant="danger">No se pudo guardar la decisión.</Alert> : null}

      <section className="ca-admin-kyc__card">
        <h3>Solicitante</h3>
        <dl className="ca-admin-kyc__meta">
          <div>
            <dt>Nombre</dt>
            <dd>{data.fullName}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{data.email}</dd>
          </div>
          <div>
            <dt>Documento</dt>
            <dd>{data.documentNumber || '—'}</dd>
          </div>
          <div>
            <dt>User ID</dt>
            <dd>
              <code>{data.userId}</code>
            </dd>
          </div>
        </dl>
      </section>

      <section className="ca-admin-kyc__docs">
        {data.photos.map((photo) => (
          <figure key={`${photo.kind}-${photo.uploadedAt}`} className="ca-admin-kyc__doc">
            <figcaption>{KIND_LABEL[photo.kind] ?? photo.kind}</figcaption>
            <a href={photo.url} target="_blank" rel="noreferrer">
              <img src={photo.url} alt={KIND_LABEL[photo.kind] ?? photo.kind} />
            </a>
          </figure>
        ))}
      </section>

      {pending ? (
        <section className="ca-admin-kyc__actions">
          <Form.Group controlId="kyc-reject-reason">
            <Form.Label>Motivo de rechazo (opcional)</Form.Label>
            <Form.Control
              as="textarea"
              rows={2}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Ej. imagen borrosa, documento ilegible…"
            />
          </Form.Group>
          <div className="ca-admin-kyc__buttons">
            <Button
              type="button"
              variant="success"
              disabled={decide.isPending}
              onClick={() => decide.mutate('approve')}
            >
              {decide.isPending ? 'Guardando…' : 'Aprobar identidad'}
            </Button>
            <Button
              type="button"
              variant="outline-danger"
              disabled={decide.isPending}
              onClick={() => decide.mutate('reject')}
            >
              Rechazar
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
