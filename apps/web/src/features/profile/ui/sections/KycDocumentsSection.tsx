import { Alert, Badge, Button, Form, Modal } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { ShieldCheck } from 'lucide-react';

import { useAppToast } from '@/shared/ui';

import { useUpdateProfile } from '../../hooks/useProfile';
import { KYC_IMAGE_OPTIONS } from '../../model/image-source';
import type { ProfilePhoto, UserPhotoKind, UserProfile } from '../../model/types';
import { ImageSourceField } from '../ImageSourceField';

const KYC_KINDS = ['ID_FRONT', 'SELFIE', 'ADDRESS_PROOF'] as const satisfies readonly UserPhotoKind[];

type KycKind = (typeof KYC_KINDS)[number];

const SLOTS: Array<{
  kind: KycKind;
  title: string;
  hint: string;
  allowPdf?: boolean;
  maxHintLabel?: string;
}> = [
  {
    kind: 'ID_FRONT',
    title: 'DNI (frente) / Pasaporte (datos personales)',
    hint: 'Foto nítida del frente del DNI o de la página de datos personales del pasaporte.',
  },
  {
    kind: 'SELFIE',
    title: 'Selfie',
    hint: 'Selfie sosteniendo el DNI de frente o el pasaporte en la página de datos personales.',
  },
  {
    kind: 'ADDRESS_PROOF',
    title: 'Comprobante de domicilio',
    hint: 'Constancia del Ministerio del Interior o un recibo a tu nombre con la dirección.',
    allowPdf: true,
    maxHintLabel: 'máx. 4 MB (PDF) / 2 MB (imagen)',
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

function hasCompleteAddress(profile: UserProfile): boolean {
  const address = profile.address;
  return Boolean(
    profile.fullName?.trim() &&
      profile.documentNumber?.trim() &&
      address?.line1?.trim() &&
      address?.city?.trim() &&
      address?.state?.trim() &&
      address?.country?.trim(),
  );
}

function mergePhotos(
  profile: UserProfile,
  kyc: Record<KycKind, string>,
): Array<{ url: string; kind: UserPhotoKind; isPrimary?: boolean }> {
  const kept = profile.photos
    .filter(
      (photo) =>
        photo.kind !== 'ID_FRONT' &&
        photo.kind !== 'ID_BACK' &&
        photo.kind !== 'SELFIE' &&
        photo.kind !== 'ADDRESS_PROOF',
    )
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

  return [
    ...kept,
    { url: kyc.ID_FRONT, kind: 'ID_FRONT', isPrimary: false },
    { url: kyc.SELFIE, kind: 'SELFIE', isPrimary: false },
    { url: kyc.ADDRESS_PROOF, kind: 'ADDRESS_PROOF', isPrimary: false },
  ];
}

export function KycDocumentsSection({ profile }: { profile: UserProfile }) {
  const update = useUpdateProfile();
  const toast = useAppToast();
  const [formError, setFormError] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [ackImmutable, setAckImmutable] = useState(false);
  const [images, setImages] = useState<Record<KycKind, string>>({
    ID_FRONT: photoByKind(profile.photos, 'ID_FRONT'),
    SELFIE: photoByKind(profile.photos, 'SELFIE'),
    ADDRESS_PROOF: photoByKind(profile.photos, 'ADDRESS_PROOF'),
  });

  const status = profile.kyc?.status ?? profile.verification?.identityStatus ?? 'UNVERIFIED';
  const locked = status === 'VERIFIED';
  const meta = statusMeta(status);
  const addressReady = hasCompleteAddress(profile);

  useEffect(() => {
    setImages({
      ID_FRONT: photoByKind(profile.photos, 'ID_FRONT'),
      SELFIE: photoByKind(profile.photos, 'SELFIE'),
      ADDRESS_PROOF: photoByKind(profile.photos, 'ADDRESS_PROOF'),
    });
  }, [profile]);

  const complete = useMemo(
    () => Boolean(images.ID_FRONT && images.SELFIE && images.ADDRESS_PROOF),
    [images],
  );

  const openConfirmModal = () => {
    setFormError(null);
    if (!addressReady) {
      setFormError(
        'Antes de verificar, guardá tu nombre, DNI/pasaporte y todos los datos de dirección en Editar perfil.',
      );
      return;
    }
    if (!complete) {
      setFormError(
        'Subí el documento, la selfie y el comprobante de domicilio para enviar la verificación.',
      );
      return;
    }
    if (locked) return;
    setAckImmutable(false);
    setShowConfirmModal(true);
  };

  const onConfirmSubmit = async () => {
    if (!ackImmutable || locked) return;
    setFormError(null);
    try {
      await update.mutateAsync({
        photos: mergePhotos(profile, images),
        submitKyc: true,
      });
      setShowConfirmModal(false);
      toast.success('Documentos enviados. Un administrador revisará tu identidad.');
    } catch {
      setFormError('No se pudieron guardar los documentos.');
    }
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
        Subí el frente de tu DNI (o la página de datos del pasaporte), una selfie sosteniendo el
        documento y un comprobante de domicilio. Con la verificación aprobada sumás puntos de KYC
        en tu reputación.
      </p>

      {!addressReady && !locked ? (
        <Alert variant="warning">
          Para enviar la verificación necesitás tener guardados tu nombre, DNI/pasaporte y la
          dirección completa.{' '}
          <Link to="/perfil?tab=settings#editar-perfil">Completar en Editar perfil</Link>
        </Alert>
      ) : null}

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
            maxHintLabel={slot.maxHintLabel ?? 'máx. 2 MB'}
            allowPdf={slot.allowPdf}
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
          disabled={locked || update.isPending || !complete || !addressReady}
          onClick={openConfirmModal}
        >
          {update.isPending
            ? 'Enviando…'
            : locked
              ? 'Identidad verificada'
              : status === 'PENDING'
                ? 'Reenviar documentos'
                : 'Verificar mi identidad'}
        </Button>
      </div>

      <Modal
        show={showConfirmModal}
        onHide={() => {
          if (update.isPending) return;
          setShowConfirmModal(false);
        }}
        centered
        aria-labelledby="kyc-confirm-title"
      >
        <Modal.Header closeButton={!update.isPending}>
          <Modal.Title id="kyc-confirm-title">Verificación de identidad</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="mb-3">
            ConfiApp agradece que hayas optado por la verificación de usuario para dar más
            confianza a la plataforma.
          </p>
          <p className="mb-3 text-muted">
            Tené en cuenta que, una vez verificado, no podrás modificar tus datos personales
            (nombre, documento y dirección). Para cambiarlos deberás realizar una solicitud
            especial a la administración de ConfiApp.
          </p>
          <Form.Check
            type="checkbox"
            id="kyc-ack-immutable"
            checked={ackImmutable}
            disabled={update.isPending}
            onChange={(event) => setAckImmutable(event.target.checked)}
            label="Entiendo que, al verificar mi identidad, no podré modificar esos datos sin una solicitud a la administración."
          />
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="outline-secondary"
            disabled={update.isPending}
            onClick={() => setShowConfirmModal(false)}
          >
            Cancelar
          </Button>
          <Button
            className="ca-btn-cta"
            disabled={!ackImmutable || update.isPending}
            onClick={() => void onConfirmSubmit()}
          >
            {update.isPending ? 'Enviando…' : 'Verificar mi identidad'}
          </Button>
        </Modal.Footer>
      </Modal>
    </section>
  );
}
