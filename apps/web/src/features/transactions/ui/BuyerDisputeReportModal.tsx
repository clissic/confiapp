import { useState } from 'react';
import { Alert, Button, Form, Modal, Spinner } from 'react-bootstrap';

import { getApiErrorMessage } from '@/shared/api/client';
import { uploadMediaFile } from '@/shared/media/uploadMedia';
import { useAppToast } from '@/shared/ui';
import type { DisputeCategory } from '@/features/disputes/api/disputes.api';
import { useOpenDispute } from '@/features/disputes/hooks/useDisputes';

export type BuyerDisputeReportKind = 'non_delivery' | 'other' | null;

const DEFAULT_NON_DELIVERY_REASON =
  'El Agente indicó que entregó el producto, pero yo no lo recibí.';

const MAX_PHOTOS = 5;

export function BuyerDisputeReportModal({
  show,
  kind,
  reason,
  pending,
  photos,
  photoError,
  onReasonChange,
  onPhotosChange,
  onClose,
  onSubmit,
}: {
  show: boolean;
  kind: BuyerDisputeReportKind;
  reason: string;
  pending: boolean;
  photos: File[];
  photoError: string | null;
  onReasonChange: (value: string) => void;
  onPhotosChange: (files: File[]) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <Modal show={show} onHide={() => (!pending ? onClose() : undefined)} centered>
      <Modal.Header closeButton={!pending}>
        <Modal.Title>
          {kind === 'non_delivery' ? 'No recibí el producto' : 'Reportar un problema'}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Alert variant="warning" className="ca-tx-dispute-modal__alert">
          Al confirmar, se abrirá una disputa. ConfiApp guarda automáticamente un expediente
          con los datos de las partes (especialmente del Agente), el chat, el estado de la
          operación, el historial, el pago y las fotos ya cargadas. Sin video ni audio.
        </Alert>
        <Form.Group className="mb-3">
          <Form.Label>Contanos qué pasó</Form.Label>
          <Form.Control
            as="textarea"
            rows={4}
            value={reason}
            maxLength={500}
            disabled={pending}
            onChange={(e) => onReasonChange(e.target.value)}
            placeholder="Describí el problema con el mayor detalle posible."
          />
        </Form.Group>
        <Form.Group>
          <Form.Label>Fotos adicionales (opcional)</Form.Label>
          <Form.Control
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            disabled={pending}
            onChange={(e) => {
              const input = e.currentTarget as HTMLInputElement;
              const list = Array.from(input.files ?? []).slice(0, MAX_PHOTOS);
              onPhotosChange(list);
            }}
          />
          <Form.Text className="text-muted">
            Solo imágenes JPEG/PNG/WebP · máx. {MAX_PHOTOS}. No se admiten video ni audio.
          </Form.Text>
          {photos.length > 0 ? (
            <ul className="ca-tx-dispute-modal__photos mb-0 mt-2">
              {photos.map((file) => (
                <li key={`${file.name}-${file.size}`}>{file.name}</li>
              ))}
            </ul>
          ) : null}
          {photoError ? <p className="text-danger small mb-0 mt-2">{photoError}</p> : null}
        </Form.Group>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" disabled={pending} onClick={onClose}>
          Volver
        </Button>
        <Button variant="danger" disabled={pending} onClick={() => void onSubmit()}>
          {pending ? (
            <>
              <Spinner size="sm" animation="border" className="me-2" />
              Enviando…
            </>
          ) : (
            'Enviar reporte'
          )}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

/** Modal + mutación para reportar disputa desde la vista comprador. */
export function useBuyerDisputeReport(code: string) {
  const toast = useAppToast();
  const openDispute = useOpenDispute(code);
  const [reportKind, setReportKind] = useState<BuyerDisputeReportKind>(null);
  const [reason, setReason] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const openReport = (kind: Exclude<BuyerDisputeReportKind, null>) => {
    setReportKind(kind);
    setReason(kind === 'non_delivery' ? DEFAULT_NON_DELIVERY_REASON : '');
    setPhotos([]);
    setPhotoError(null);
  };

  const closeReport = () => {
    if (uploading || openDispute.isPending) return;
    setReportKind(null);
  };

  const submitReport = async () => {
    if (!reportKind) return;
    const trimmed = reason.trim();
    if (trimmed.length < 3) {
      toast.error('Contanos brevemente qué pasó (mínimo 3 caracteres).');
      return;
    }
    try {
      setPhotoError(null);
      setUploading(true);
      const photoStorageKeys: string[] = [];
      for (const file of photos.slice(0, MAX_PHOTOS)) {
        if (!/^image\/(jpeg|jpg|png|webp)$/i.test(file.type)) {
          setPhotoError('Solo se admiten fotos JPEG/PNG/WebP.');
          setUploading(false);
          return;
        }
        const uploaded = await uploadMediaFile(file, 'evidence');
        photoStorageKeys.push(uploaded.storageKey);
      }
      await openDispute.mutateAsync({
        reason: trimmed,
        category: (reportKind === 'non_delivery' ? 'NON_DELIVERY' : 'OTHER') as DisputeCategory,
        photoStorageKeys: photoStorageKeys.length ? photoStorageKeys : undefined,
      });
      toast.success('Reporte registrado. Un administrador revisará el expediente.');
      setReportKind(null);
      setPhotos([]);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'No se pudo registrar el reporte.'));
    } finally {
      setUploading(false);
    }
  };

  const pending = openDispute.isPending || uploading;

  return {
    isPending: pending,
    openReport,
    reportModal: (
      <BuyerDisputeReportModal
        show={reportKind != null}
        kind={reportKind}
        reason={reason}
        pending={pending}
        photos={photos}
        photoError={photoError}
        onReasonChange={setReason}
        onPhotosChange={setPhotos}
        onClose={closeReport}
        onSubmit={() => void submitReport()}
      />
    ),
  };
}
