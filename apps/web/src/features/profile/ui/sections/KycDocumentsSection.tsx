import { Alert, Badge, Button } from 'react-bootstrap';
import { useEffect, useMemo, useState } from 'react';
import { ShieldCheck } from 'lucide-react';

import { useAppToast } from '@/shared/ui';

import { useUpdateProfile } from '../../hooks/useProfile';
import { KYC_IMAGE_OPTIONS } from '../../model/image-source';
import type { ProfilePhoto, UserPhotoKind, UserProfile } from '../../model/types';
import { ImageSourceField } from '../ImageSourceField';

const KYC_KINDS = ['ID_FRONT', 'ID_BACK', 'SELFIE'] as const satisfies readonly UserPhotoKind[];

type KycKind = (typeof KYC_KINDS)[number];

const SLOTS: Array<{ kind: KycKind; title: string; hint: string }> = [
  {
    kind: 'ID_FRONT',
    title: 'DNI (frente) / Pasaporte (datos personales)',
    hint: 'Foto nítida del frente del DNI o de la página de datos personales del pasaporte.',
  },
  {
    kind: 'ID_BACK',
    title: 'DNI (dorso)',
    hint: 'Foto nítida del reverso del DNI (no es necesario si se optó subir foto del pasaporte).',
  },
  {
    kind: 'SELFIE',
    title: 'Selfie',
    hint: 'Selfie sosteniendo el DNI de frente o el pasaporte en la página de datos personales.',
  },
];

function statusMeta(status: string): { label: string; variant: string } {
  switch (status) {
    case 'VERIFIED':
      return { label: 'Verificado', variant: 'success' };
    case 'PENDING':
      return { label: 'En revisión', variant: 'warning' };
    case 'REJECTED':
      return { label: 'Rechazado', variant: 'danger' };
    default:
      return { label: 'Sin enviar', variant: 'secondary' };
  }
}

function photoByKind(photos: ProfilePhoto[], kind: KycKind): string {
  return photos.find((photo) => photo.kind === kind)?.url ?? '';
}

function mergePhotos(
  profile: UserProfile,
  kyc: Record<KycKind, string>,
): Array<{ url: string; kind: UserPhotoKind; isPrimary?: boolean }> {
  const kept = profile.photos
    .filter((photo) => !(KYC_KINDS as readonly string[]).includes(photo.kind))
    .map((photo) => ({
      url: photo.url,
      kind: photo.kind,
      isPrimary: photo.isPrimary,
    }));

  if (
    profile.avatar &&
    !kept.some((photo) => photo.url === profile.avatar || photo.kind === 'AVATAR')
  ) {
    kept.unshift({ url: profile.avatar, kind: 'AVATAR', isPrimary: true });
  }

  const docs: Array<{ url: string; kind: UserPhotoKind; isPrimary?: boolean }> = [
    { url: kyc.ID_FRONT, kind: 'ID_FRONT', isPrimary: false },
    { url: kyc.SELFIE, kind: 'SELFIE', isPrimary: false },
  ];
  if (kyc.ID_BACK) {
    docs.splice(1, 0, { url: kyc.ID_BACK, kind: 'ID_BACK', isPrimary: false });
  }

  return [...kept, ...docs];
}

export function KycDocumentsSection({ profile }: { profile: UserProfile }) {
  const update = useUpdateProfile();
  const toast = useAppToast();
  const [formError, setFormError] = useState<string | null>(null);
  const [images, setImages] = useState<Record<KycKind, string>>({
    ID_FRONT: photoByKind(profile.photos, 'ID_FRONT'),
    ID_BACK: photoByKind(profile.photos, 'ID_BACK'),
    SELFIE: photoByKind(profile.photos, 'SELFIE'),
  });

  const status = profile.kyc?.status ?? profile.verification?.identityStatus ?? 'UNVERIFIED';
  const locked = status === 'VERIFIED';
  const meta = statusMeta(status);

  useEffect(() => {
    setImages({
      ID_FRONT: photoByKind(profile.photos, 'ID_FRONT'),
      ID_BACK: photoByKind(profile.photos, 'ID_BACK'),
      SELFIE: photoByKind(profile.photos, 'SELFIE'),
    });
  }, [profile]);

  const complete = useMemo(
    () => Boolean(images.ID_FRONT && images.SELFIE),
    [images],
  );

  const onSubmit = async () => {
    setFormError(null);
    if (!complete) {
      setFormError('Completá las tres imágenes para enviar la verificación.');
      return;
    }
    if (locked) return;

    await update.mutateAsync({
      photos: mergePhotos(profile, images),
      submitKyc: true,
    });
    toast.success('Documentos enviados. Un administrador revisará tu identidad.');
  };

  return (
    <section id="verificar-identidad" className="ca-kyc">
      <h3 className="ca-section-title">
        <ShieldCheck size={22} strokeWidth={1.75} aria-hidden />
        Verificar identidad
        <Badge bg={meta.variant} className="ca-kyc__badge">
          {meta.label}
        </Badge>
      </h3>
      <p className="ca-section-lead">
        Subí el frente y el dorso de tu DNI (o la página de datos del pasaporte), más una selfie.
        Con la verificación aprobada sumás puntos de KYC en tu reputación.
      </p>

      {status === 'REJECTED' && profile.kyc?.rejectionReason ? (
        <Alert variant="danger">Motivo del rechazo: {profile.kyc.rejectionReason}</Alert>
      ) : null}
      {formError ? <Alert variant="danger">{formError}</Alert> : null}
      {update.isError ? <Alert variant="danger">No se pudieron guardar los documentos.</Alert> : null}

      <div className="ca-kyc__grid">
        {SLOTS.map((slot) => (
          <ImageSourceField
            key={slot.kind}
            id={`kyc-${slot.kind.toLowerCase()}`}
            title={slot.title}
            hint={slot.hint}
            value={images[slot.kind]}
            disabled={locked || update.isPending}
            processOptions={KYC_IMAGE_OPTIONS}
            maxHintLabel="máx. 2 MB"
            onChange={(url) => {
              setImages((prev) => ({ ...prev, [slot.kind]: url }));
              setFormError(null);
            }}
          />
        ))}
      </div>

      <div className="ca-form-actions">
        <Button
          type="button"
          className="ca-btn-cta"
          disabled={locked || update.isPending || !complete}
          onClick={() => void onSubmit()}
        >
          {update.isPending
            ? 'Enviando…'
            : locked
              ? 'Identidad verificada'
              : status === 'PENDING'
                ? 'Reenviar documentos'
                : 'Enviar para verificación'}
        </Button>
      </div>
    </section>
  );
}
