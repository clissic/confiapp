import { useState } from 'react';
import { Button, Modal, Spinner } from 'react-bootstrap';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, MapPinCheck, PackageCheck, PackageX, ShieldCheck } from 'lucide-react';

import { getApiErrorMessage, isRequestTimeoutError } from '@/shared/api/client';
import { formatDateTime } from '@/shared/lib/money';
import { useAppToast } from '@/shared/ui';
import { getTransactionByCode } from '../api/transactions.api';
import {
  transactionsQueryKey,
  useBuyerAcceptProduct,
  useBuyerConfirmArrival,
  useBuyerRejectProduct,
} from '../hooks/useTransactions';
import type { Transaction } from '../model/types';
import { useBuyerDisputeReport } from './BuyerDisputeReportModal';
import { DeliveryConfirmationHint } from './DeliveryConfirmationHint';

type ConfirmKind = 'accept' | 'reject' | 'arrival' | null;

/** Decisión del comprador tras la verificación + confirmación de arribo. */
export function BuyerProductDecisionPanel({ tx }: { tx: Transaction }) {
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const accept = useBuyerAcceptProduct(tx.code);
  const reject = useBuyerRejectProduct(tx.code);
  const confirmArrival = useBuyerConfirmArrival(tx.code);
  const disputeReport = useBuyerDisputeReport(tx.code);
  const [confirm, setConfirm] = useState<ConfirmKind>(null);

  const verification = tx.agentVerification;
  if (!verification) return null;

  const pending =
    accept.isPending ||
    reject.isPending ||
    confirmArrival.isPending ||
    disputeReport.isPending;
  const decided = Boolean(verification.buyerDecision);
  const accepted = verification.buyerDecision === 'ACCEPTED';
  const rejected = verification.buyerDecision === 'REJECTED';
  const arrivalDone = Boolean(tx.deliveryConfirmation?.buyerArrivalConfirmedAt);
  const agentDeliveryDone = Boolean(tx.deliveryConfirmation?.agentDeliveryConfirmedAt);
  const canDecide =
    !decided &&
    tx.status !== 'DISPUTED' &&
    (tx.status === 'FUNDED' || tx.status === 'IN_PROGRESS');
  const canConfirmArrival =
    accepted &&
    !arrivalDone &&
    tx.status !== 'DISPUTED' &&
    (tx.status === 'FUNDED' || tx.status === 'IN_PROGRESS');

  const onConfirm = async () => {
    if (!confirm) return;
    try {
      if (confirm === 'accept') {
        await accept.mutateAsync();
        toast.success('Producto aceptado. El Agente inicia el viaje hacia vos.');
      } else if (confirm === 'reject') {
        await reject.mutateAsync();
        toast.success('Compra cancelada. Se inició el reembolso del pago protegido.');
      } else {
        await confirmArrival.mutateAsync();
        toast.success(
          agentDeliveryDone
            ? 'Arribo confirmado. La operación se completó y se liberaron los fondos.'
            : 'Arribo confirmado. Esperamos la confirmación de entrega del Agente.',
        );
      }
      setConfirm(null);
    } catch (err) {
      if (confirm === 'arrival' && isRequestTimeoutError(err)) {
        try {
          const refreshed = await getTransactionByCode(tx.code);
          if (refreshed.data.deliveryConfirmation?.buyerArrivalConfirmedAt) {
            queryClient.setQueryData(
              [...transactionsQueryKey, 'code', refreshed.data.code],
              refreshed,
            );
            void queryClient.invalidateQueries({ queryKey: transactionsQueryKey });
            toast.success(
              refreshed.data.status === 'COMPLETED' || agentDeliveryDone
                ? 'Arribo confirmado. La operación se completó y se liberaron los fondos.'
                : 'Arribo confirmado. Esperamos la confirmación de entrega del Agente.',
            );
            setConfirm(null);
            return;
          }
        } catch {
          /* seguir con el error genérico */
        }
      }
      toast.error(
        getApiErrorMessage(
          err,
          confirm === 'accept'
            ? 'No se pudo aceptar el producto.'
            : confirm === 'reject'
              ? 'No se pudo rechazar el producto.'
              : 'No se pudo confirmar el arribo.',
        ),
      );
    }
  };

  return (
    <section className="ca-tx-panel ca-tx-product-decision">
      <header className="ca-tx-product-decision__head">
        <p className="ca-tx-product-decision__kicker">
          <ShieldCheck size={15} strokeWidth={1.75} aria-hidden />
          Verificación del Agente
        </p>
        <h2 className="ca-tx-product-decision__title">
          {verification.allPassed
            ? 'La verificación fue correcta'
            : 'La verificación tuvo observaciones'}
        </h2>
        <p className="ca-tx-product-decision__lead mb-0">
          {!decided
            ? 'La verificación se hizo al retirar el producto del vendedor. Podés aceptar (el Agente te lo lleva) o rechazar y cancelar la compra.'
            : rejected
              ? 'Rechazaste el producto y cancelaste la compra.'
              : arrivalDone && agentDeliveryDone
                ? 'Arribo y entrega confirmados. La operación quedó completada.'
                : arrivalDone
                  ? 'Confirmaste el arribo. Esperamos que el Agente confirme la entrega.'
                  : 'Aceptaste el producto. Cuando te llegue, confirmá el arribo. Los fondos se liberan al confirmar también el Agente.'}
        </p>
      </header>

      {verification.note ? (
        <blockquote className="ca-tx-product-decision__note">
          <span className="ca-tx-product-decision__note-label">Nota del Agente</span>
          <p>{verification.note}</p>
        </blockquote>
      ) : null}

      {!verification.allPassed && canDecide ? (
        <p className="ca-tx-product-decision__hint">
          El Agente marcó que faltaron pasos. Podés aceptar igual si estás conforme, o rechazar y
          cancelar.
        </p>
      ) : null}

      {canDecide ? (
        <div className="ca-tx-product-decision__actions">
          <Button
            type="button"
            className="ca-btn-cta"
            disabled={pending}
            onClick={() => setConfirm('accept')}
          >
            <PackageCheck size={16} strokeWidth={1.75} aria-hidden />
            Aceptar el producto
          </Button>
          <Button
            type="button"
            variant="outline-danger"
            disabled={pending}
            onClick={() => setConfirm('reject')}
          >
            <PackageX size={16} strokeWidth={1.75} aria-hidden />
            Rechazar y cancelar la compra
          </Button>
        </div>
      ) : null}

      {canConfirmArrival ? (
        <>
          {agentDeliveryDone ? (
            <p className="ca-tx-agent-delivery-notice__compact mb-0">
              El Agente declaró entrega el{' '}
              <time dateTime={tx.deliveryConfirmation!.agentDeliveryConfirmedAt!}>
                {formatDateTime(tx.deliveryConfirmation!.agentDeliveryConfirmedAt!)}
              </time>
              {tx.deliveryConfirmation?.autoReleaseAt ? (
                <>
                  {' '}
                  · auto-completado el{' '}
                  <time dateTime={tx.deliveryConfirmation.autoReleaseAt}>
                    {formatDateTime(tx.deliveryConfirmation.autoReleaseAt)}
                  </time>{' '}
                  si no respondés
                </>
              ) : null}
            </p>
          ) : null}
          <DeliveryConfirmationHint
            subtle
            showDeadline={!arrivalDone && Boolean(tx.deliveryConfirmation?.autoReleaseAt)}
            autoReleaseAt={tx.deliveryConfirmation?.autoReleaseAt}
          />
          <div
            className={`ca-tx-product-decision__actions${
              agentDeliveryDone ? ' ca-tx-product-decision__actions--split' : ''
            }`}
          >
            <Button
              type="button"
              className="ca-btn-cta"
              disabled={pending}
              onClick={() => setConfirm('arrival')}
            >
              <MapPinCheck size={16} strokeWidth={1.75} aria-hidden />
              Confirmar arribo del producto
            </Button>
            {agentDeliveryDone ? (
              <Button
                type="button"
                variant="outline-danger"
                size="sm"
                className="ca-tx-product-decision__report-btn"
                disabled={pending}
                onClick={() => disputeReport.openReport('non_delivery')}
              >
                <PackageX size={15} strokeWidth={1.75} aria-hidden />
                No recibí el producto
              </Button>
            ) : null}
          </div>
        </>
      ) : null}

      {accepted && arrivalDone ? (
        <p className="ca-tx-product-decision__done mb-0">
          <CheckCircle2 size={16} strokeWidth={1.75} aria-hidden />
          {agentDeliveryDone
            ? 'Arribo confirmado · entrega del Agente confirmada'
            : 'Arribo confirmado · pendiente confirmación del Agente'}
        </p>
      ) : null}

      {rejected ? (
        <p className="ca-tx-product-decision__done mb-0">
          <CheckCircle2 size={16} strokeWidth={1.75} aria-hidden />
          Decisión registrada: producto rechazado
        </p>
      ) : null}

      <Modal
        show={confirm != null}
        onHide={() => (!pending ? setConfirm(null) : undefined)}
        centered
      >
        <Modal.Header closeButton={!pending}>
          <Modal.Title>
            {confirm === 'accept'
              ? 'Aceptar el producto'
              : confirm === 'reject'
                ? 'Rechazar y cancelar'
                : 'Confirmar arribo'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {confirm === 'accept' ? (
            <>
              <p>
                Al confirmar, el Agente inicia el viaje hacia vos con el producto. Los fondos siguen
                en resguardo hasta que confirmes el arribo y el Agente confirme la entrega.
              </p>
              <p className="ca-tx-product-decision__irreversible mb-0">
                Esta elección no se puede deshacer.
              </p>
            </>
          ) : confirm === 'reject' ? (
            <>
              <p>
                Al confirmar, se cancela la compra y se inicia el reembolso del pago protegido. El
                Agente coordinará la devolución al vendedor si ya tenía el producto.
              </p>
              <p className="ca-tx-product-decision__irreversible mb-0">
                Esta elección no se puede deshacer.
              </p>
            </>
          ) : (
            <p className="mb-0">
              {agentDeliveryDone
                ? 'Confirmá solo si ya recibiste el producto. Al confirmar, se liberarán los fondos al vendedor.'
                : 'Confirmá solo si ya recibiste el producto. Cuando el Agente también confirme la entrega, se liberarán los fondos al vendedor.'}
            </p>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="outline-secondary"
            disabled={pending}
            onClick={() => setConfirm(null)}
          >
            Volver
          </Button>
          <Button
            className={confirm === 'reject' ? undefined : 'ca-btn-cta'}
            variant={confirm === 'reject' ? 'danger' : undefined}
            disabled={pending}
            onClick={() => void onConfirm()}
          >
            {pending ? (
              <>
                <Spinner size="sm" animation="border" className="me-2" />
                Procesando…
              </>
            ) : confirm === 'accept' ? (
              'Confirmar aceptación'
            ) : confirm === 'reject' ? (
              'Confirmar rechazo'
            ) : (
              'Confirmar arribo'
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      {disputeReport.reportModal}
    </section>
  );
}
