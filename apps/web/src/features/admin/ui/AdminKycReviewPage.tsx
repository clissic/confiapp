import { Alert, Button, Form, Spinner } from 'react-bootstrap';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  BadgeCheck,
  CheckCircle2,
  FileText,
  IdCard,
  Mail,
  MapPin,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from 'lucide-react';

import { apiClient } from '@/shared/api/client';
import { useAuth } from '@/features/auth/ui/AuthProvider';
import { useAppToast } from '@/shared/ui';
import { PhotoLightbox } from '@/features/transactions/ui/PhotoLightbox';

import './admin-kyc.css';

type KycAddress = {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  formatted?: string;
};

type KycReviewDto = {
  userId: string;
  fullName: string;
  email: string;
  documentNumber?: string;
  address?: KycAddress;
  locationLabel?: string;
  status?: string;
  photos: Array<{ kind: string; url: string; uploadedAt: string }>;
  submittedAt?: string;
};

const KIND_LABEL: Record<string, string> = {
  ID_FRONT: 'Documento (frente / pasaporte)',
  ID_BACK: 'Documento (dorso)',
  SELFIE: 'Selfie con documento',
  ADDRESS_PROOF: 'Comprobante de domicilio',
};

type StatusTone = 'pending' | 'ok' | 'danger' | 'muted';

function statusMeta(status?: string): { label: string; tone: StatusTone } {
  switch (status) {
    case 'PENDING':
      return { label: 'En revisión', tone: 'pending' };
    case 'VERIFIED':
      return { label: 'Verificado', tone: 'ok' };
    case 'REJECTED':
      return { label: 'Rechazado', tone: 'danger' };
    default:
      return { label: 'Sin estado', tone: 'muted' };
  }
}

function initialsFromName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
}

function formatSubmittedAt(value?: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('es-UY', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function isPdfUrl(url: string): boolean {
  return (
    url.startsWith('data:application/pdf') ||
    /\.pdf(\?|$)/i.test(url) ||
    url.includes('application/pdf')
  );
}

function formatAddressLines(address?: KycAddress, locationLabel?: string): string[] {
  if (!address && !locationLabel) return [];
  const lines = [
    address?.line1,
    address?.line2,
    [address?.city, address?.state].filter(Boolean).join(', ') || undefined,
    [address?.postalCode, address?.country].filter(Boolean).join(' ') || undefined,
    locationLabel ? `Barrio: ${locationLabel}` : undefined,
  ].filter((line): line is string => Boolean(line?.trim()));
  return lines;
}

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
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null);

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

  const submittedLabel = useMemo(
    () => formatSubmittedAt(review.data?.submittedAt),
    [review.data?.submittedAt],
  );

  const addressLines = useMemo(
    () => formatAddressLines(review.data?.address, review.data?.locationLabel),
    [review.data?.address, review.data?.locationLabel],
  );

  if (user?.role !== 'ADMIN') {
    return (
      <div className="ca-admin-kyc">
        <Alert variant="danger" className="ca-admin-kyc__alert mb-0">
          <ShieldAlert size={18} className="me-2" aria-hidden />
          Solo los administradores pueden acceder a esta revisión.
        </Alert>
      </div>
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
      <div className="ca-admin-kyc">
        <Alert variant="danger" className="ca-admin-kyc__alert mb-0">
          No se encontró la solicitud o el enlace expiró.
        </Alert>
      </div>
    );
  }

  const data = review.data;
  const pending = data.status === 'PENDING';
  const verified = data.status === 'VERIFIED';
  const rejected = data.status === 'REJECTED';
  const status = statusMeta(data.status);
  const initials = initialsFromName(data.fullName);
  const imagePhotos = data.photos.filter((photo) => !isPdfUrl(photo.url));
  const galleryImages = imagePhotos.map((photo) => ({
    url: photo.url,
    alt: KIND_LABEL[photo.kind] ?? photo.kind,
  }));

  return (
    <div className="ca-admin-kyc">
      <header className="ca-admin-kyc__hero">
        <div className="ca-admin-kyc__hero-copy">
          <p className="ca-admin-kyc__kicker">
            <ShieldCheck size={14} strokeWidth={2} aria-hidden />
            Administración · KYC
          </p>
          <h1 className="ca-admin-kyc__title">Verificar identidad</h1>
          <p className="ca-admin-kyc__lead">
            Revisá el documento, la selfie y el comprobante de domicilio. Si coinciden y se leen
            bien, aprobá la identidad.
          </p>
        </div>
        <span className={`ca-admin-kyc__chip ca-admin-kyc__chip--${status.tone}`}>
          {status.tone === 'ok' ? <CheckCircle2 size={15} strokeWidth={2} aria-hidden /> : null}
          {status.tone === 'danger' ? <XCircle size={15} strokeWidth={2} aria-hidden /> : null}
          {status.tone === 'pending' ? <BadgeCheck size={15} strokeWidth={2} aria-hidden /> : null}
          {status.label}
        </span>
      </header>

      {decide.isError ? (
        <Alert variant="danger" className="mb-0">
          No se pudo guardar la decisión. Probá de nuevo.
        </Alert>
      ) : null}

      {!pending ? (
        <Alert
          variant={verified ? 'success' : rejected ? 'danger' : 'secondary'}
          className="ca-admin-kyc__result mb-0"
        >
          {verified
            ? 'Esta identidad ya fue aprobada. No hace falta ninguna acción.'
            : rejected
              ? 'Esta solicitud ya fue rechazada.'
              : 'Esta solicitud ya no está pendiente.'}
        </Alert>
      ) : null}

      <section className="ca-admin-kyc__panel ca-admin-kyc__panel--person">
        <div className="ca-admin-kyc__person">
          <div className="ca-admin-kyc__avatar" aria-hidden>
            {initials}
          </div>
          <div className="ca-admin-kyc__person-main">
            <div className="ca-admin-kyc__person-top">
              <h2 className="ca-admin-kyc__person-name">{data.fullName}</h2>
              {submittedLabel ? (
                <p className="ca-admin-kyc__panel-meta">Enviado {submittedLabel}</p>
              ) : null}
            </div>
            <p className="ca-admin-kyc__person-line">
              <Mail size={14} strokeWidth={1.75} aria-hidden />
              {data.email}
            </p>
            <p className="ca-admin-kyc__person-line">
              <IdCard size={14} strokeWidth={1.75} aria-hidden />
              {data.documentNumber?.trim() || 'Sin documento cargado'}
            </p>
            {addressLines.length > 0 ? (
              <div className="ca-admin-kyc__person-line ca-admin-kyc__person-line--address">
                <MapPin size={14} strokeWidth={1.75} aria-hidden />
                <div>
                  {addressLines.map((line) => (
                    <span key={line} className="d-block">
                      {line}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <p className="ca-admin-kyc__person-line">
                <MapPin size={14} strokeWidth={1.75} aria-hidden />
                Sin domicilio cargado
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="ca-admin-kyc__panel">
        <div className="ca-admin-kyc__panel-head">
          <h2 className="ca-admin-kyc__panel-title">
            <FileText size={18} strokeWidth={1.75} aria-hidden />
            Documentos enviados
          </h2>
          <p className="ca-admin-kyc__panel-meta">
            {data.photos.length === 1 ? '1 archivo' : `${data.photos.length} archivos`}
          </p>
        </div>

        {data.photos.length === 0 ? (
          <p className="ca-admin-kyc__empty">No hay archivos adjuntos en esta solicitud.</p>
        ) : (
          <div className="ca-admin-kyc__docs row g-3">
            {data.photos.map((photo) => {
              const title = KIND_LABEL[photo.kind] ?? photo.kind;
              const pdf = isPdfUrl(photo.url);
              const galleryIdx = pdf
                ? -1
                : imagePhotos.findIndex(
                    (item) => item.kind === photo.kind && item.url === photo.url,
                  );
              return (
                <figure key={`${photo.kind}-${photo.uploadedAt}`} className="ca-admin-kyc__doc col-12 col-md-6">
                  <figcaption className="ca-admin-kyc__doc-title">{title}</figcaption>
                  {pdf ? (
                    <div className="ca-admin-kyc__pdf">
                      <object
                        data={photo.url}
                        type="application/pdf"
                        className="ca-admin-kyc__pdf-object"
                        aria-label={title}
                      >
                        <p className="ca-admin-kyc__pdf-fallback mb-0">
                          No se pudo previsualizar el PDF.{' '}
                          <a href={photo.url} target="_blank" rel="noreferrer">
                            Abrir archivo
                          </a>
                        </p>
                      </object>
                      <a
                        className="ca-admin-kyc__pdf-link"
                        href={photo.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Abrir PDF
                      </a>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="ca-admin-kyc__doc-btn"
                      onClick={() => {
                        if (galleryIdx >= 0) setGalleryIndex(galleryIdx);
                      }}
                      aria-label={`Ver ${title} en grande`}
                    >
                      <img src={photo.url} alt={title} />
                    </button>
                  )}
                </figure>
              );
            })}
          </div>
        )}
      </section>

      {pending ? (
        <section className="ca-admin-kyc__panel ca-admin-kyc__panel--decide">
          <div className="ca-admin-kyc__panel-head">
            <h2 className="ca-admin-kyc__panel-title">
              <BadgeCheck size={18} strokeWidth={1.75} aria-hidden />
              Decisión
            </h2>
            <p className="ca-admin-kyc__panel-meta">La persona recibirá un aviso por la app</p>
          </div>

          <Form.Group controlId="kyc-reject-reason" className="ca-admin-kyc__reason">
            <Form.Label>Motivo de rechazo (opcional)</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Ej. imagen borrosa, documento ilegible, selfie que no coincide…"
            />
          </Form.Group>

          <div className="ca-admin-kyc__buttons">
            <Button
              type="button"
              className="ca-admin-kyc__approve"
              disabled={decide.isPending}
              onClick={() => decide.mutate('approve')}
            >
              <CheckCircle2 size={18} strokeWidth={2} aria-hidden />
              {decide.isPending ? 'Guardando…' : 'Aprobar identidad'}
            </Button>
            <Button
              type="button"
              variant="outline-danger"
              className="ca-admin-kyc__reject"
              disabled={decide.isPending}
              onClick={() => decide.mutate('reject')}
            >
              <XCircle size={18} strokeWidth={2} aria-hidden />
              Rechazar
            </Button>
          </div>
        </section>
      ) : null}

      <PhotoLightbox
        images={galleryImages}
        index={galleryIndex ?? 0}
        open={galleryIndex != null}
        onClose={() => setGalleryIndex(null)}
        onIndexChange={setGalleryIndex}
      />
    </div>
  );
}
