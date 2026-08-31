import { useState } from 'react';
import { Alert, Button, Form, Modal, Spinner } from 'react-bootstrap';

import { getApiErrorMessage } from '@/shared/api/client';
import { useAppToast } from '@/shared/ui';
import type { DisputeCategory } from '@/features/disputes/api/disputes.api';
import { useOpenDispute } from '@/features/disputes/hooks/useDisputes';

export type BuyerDisputeReportKind = 'non_delivery' | 'other' | null;

const DEFAULT_NON_DELIVERY_REASON =
  'El Agente indicó que entregó el producto, pero yo no lo recibí.';

export function BuyerDisputeReportModal({
  show,
  kind,
  reason,
  pending,
  onReasonChange,
  onClose,
  onSubmit,
}: {
  show: boolean;
  kind: BuyerDisputeReportKind;
  reason: string;
  pending: boolean;
  onReasonChange: (value: string) => void;
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
          Al confirmar, se abrirá una disputa y se pausará la liberación de fondos hasta que un
          administrador revise el caso.
        </Alert>
        <Form.Group>
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

  const openReport = (kind: Exclude<BuyerDisputeReportKind, null>) => {
    setReportKind(kind);
    setReason(kind === 'non_delivery' ? DEFAULT_NON_DELIVERY_REASON : '');
  };

  const closeReport = () => setReportKind(null);

  const submitReport = async () => {
    if (!reportKind) return;
    const trimmed = reason.trim();
    if (trimmed.length < 3) {
      toast.error('Contanos brevemente qué pasó (mínimo 3 caracteres).');
      return;
    }
    try {
      await openDispute.mutateAsync({
        reason: trimmed,
        category: (reportKind === 'non_delivery' ? 'NON_DELIVERY' : 'OTHER') as DisputeCategory,
      });
      toast.success('Reporte registrado. Un administrador revisará el caso.');
      setReportKind(null);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'No se pudo registrar el reporte.'));
    }
  };

  return {
    isPending: openDispute.isPending,
    openReport,
    reportModal: (
      <BuyerDisputeReportModal
        show={reportKind != null}
        kind={reportKind}
        reason={reason}
        pending={openDispute.isPending}
        onReasonChange={setReason}
        onClose={closeReport}
        onSubmit={() => void submitReport()}
      />
    ),
  };
}
