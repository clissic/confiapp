import { useState } from 'react';
import { Alert, Badge, Button, Modal, Spinner } from 'react-bootstrap';
import { CheckCircle2, LogOut, MapPin, Package, PackageCheck } from 'lucide-react';

import { formatOperationMoney } from '@/shared/lib/money';
import { getApiErrorMessage } from '@/shared/api/client';
import { ReviewFormPanel } from '@/features/reputation';
import { useAppToast } from '@/shared/ui';
import {
  useAgentConfirmDelivery,
  useFinalizeAgentVerification,
  useToggleChecklistItem,
} from '../hooks/useTransactions';
import {
  STATUS_LABELS,
  type Transaction,
  type TransactionChecklistItem,
  type TransactionStatus,
} from '../model/types';
import { AgentChecklistPanel } from './AgentChecklistPanel';
import { DeliveryConfirmationHint } from './DeliveryConfirmationHint';
import { OperationHistoryAccordion } from './OperationHistoryAccordion';
import { PhotoLightbox } from './PhotoLightbox';

const AGENT_PIPELINE = [
  'ACCEPTED',
  'FUNDED',
  'IN_PROGRESS',
  'COMPLETED',
] as const satisfies readonly TransactionStatus[];

const AGENT_PIPELINE_LABELS: Record<(typeof AGENT_PIPELINE)[number], string> = {
  ACCEPTED: 'Aceptada',
  FUNDED: 'Pago',
  IN_PROGRESS: 'En curso',
  COMPLETED: 'Listo',
};

function pipelineIndex(status: TransactionStatus): number {
  if (status === 'CREATED' || status === 'WAITING_PARTICIPANT' || status === 'PENDING_BUYER_CONFIRM') {
    return 0;
  }
  const idx = AGENT_PIPELINE.indexOf(status as (typeof AGENT_PIPELINE)[number]);
  return idx >= 0 ? idx : status === 'CANCELLED' || status === 'DISPUTED' ? -1 : 0;
}

function placeLabel(label?: string): string {
  return label?.trim() || 'A coordinar';
}

/** Vista minimalista del detalle para el Agente intermediario. */
export function AgentOperationDetail({
  tx,
  error,
  withdrawing,
  onWithdraw,
  onGallery,
  galleryIndex,
  onCloseGallery,
}: {
  tx: Transaction;
  error: string | null;
  withdrawing: boolean;
  onWithdraw: () => void;
  onGallery: (index: number) => void;
  galleryIndex: number | null;
  onCloseGallery: () => void;
}) {
  const toast = useAppToast();
  const toggleChecklist = useToggleChecklistItem(tx.code);
  const finalize = useFinalizeAgentVerification(tx.code);
  const confirmDelivery = useAgentConfirmDelivery(tx.code);
  const [deliveryConfirmOpen, setDeliveryConfirmOpen] = useState(false);

  const canToggle =
    !tx.agentVerification &&
    (tx.status === 'FUNDED' || tx.status === 'IN_PROGRESS');
  const canWithdraw =
    tx.status === 'WAITING_PARTICIPANT' ||
    tx.status === 'ACCEPTED' ||
    tx.status === 'FUNDED' ||
    tx.status === 'IN_PROGRESS' ||
    tx.status === 'DISPUTED';
  const buyerAccepted = tx.agentVerification?.buyerDecision === 'ACCEPTED';
  const agentDeliveryDone = Boolean(tx.deliveryConfirmation?.agentDeliveryConfirmedAt);
  const buyerArrivalDone = Boolean(tx.deliveryConfirmation?.buyerArrivalConfirmedAt);
  const canConfirmDelivery =
    buyerAccepted &&
    !agentDeliveryDone &&
    (tx.status === 'FUNDED' || tx.status === 'IN_PROGRESS');

  const buyerItems = tx.party?.buyer?.checklist ?? [];
  const sellerItems = tx.party?.seller?.checklist ?? [];
  const legacyItems =
    !buyerItems.length && !sellerItems.length ? (tx.conditions.checklist ?? []) : [];

  const checklistBlocks: Array<{
    key: string;
    title: string;
    items: TransactionChecklistItem[];
    side?: 'buyer' | 'seller';
  }> = [];
  if (buyerItems.length) {
    checklistBlocks.push({
      key: 'buyer',
      title: 'Verificación — comprador',
      items: buyerItems,
      side: 'buyer',
    });
  }
  if (sellerItems.length) {
    checklistBlocks.push({
      key: 'seller',
      title: 'Verificación — vendedor',
      items: sellerItems,
      side: 'seller',
    });
  }
  if (!checklistBlocks.length && legacyItems.length) {
    checklistBlocks.push({
      key: 'legacy',
      title: 'Verificación',
      items: legacyItems,
    });
  }

  const allChecklistItems = checklistBlocks.flatMap((block) => block.items);
  const allChecklistPassed =
    allChecklistItems.length > 0 && allChecklistItems.every((item) => item.done);
  const currentPipeline = pipelineIndex(tx.status);
  const productImages = tx.product?.images ?? [];

  const onFinalize = async (note?: string) => {
    try {
      const result = await finalize.mutateAsync(note);
      toast.success(
        result.data.agentVerification?.allPassed
          ? 'Verificación correcta. Notificamos al comprador.'
          : 'Verificación con observaciones. Notificamos al comprador.',
      );
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'No se pudo finalizar la verificación.'));
      throw err;
    }
  };

  const onConfirmDelivery = async () => {
    try {
      await confirmDelivery.mutateAsync();
      toast.success(
        buyerArrivalDone
          ? 'Entrega confirmada. La operación se completó y se liberaron los fondos.'
          : 'Entrega confirmada. Esperamos que el comprador confirme el arribo.',
      );
      setDeliveryConfirmOpen(false);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'No se pudo confirmar la entrega.'));
    }
  };

  return (
    <div className="ca-tx ca-tx--detail ca-tx-agent-view">
      <header className="ca-tx-agent-view__hero">
        <p className="ca-tx-agent-view__code">{tx.code}</p>
        <h1 className="ca-tx-agent-view__title">{tx.title}</h1>
        <div className="ca-tx-agent-view__meta">
          <Badge bg="primary">{STATUS_LABELS[tx.status]}</Badge>
          <strong>{formatOperationMoney(tx.amountCents, tx.currency)}</strong>
        </div>
      </header>

      {error ? <Alert variant="danger">{error}</Alert> : null}

      {tx.status !== 'CANCELLED' && tx.status !== 'DISPUTED' ? (
        <ol className="ca-tx-agent-view__pipeline" aria-label="Progreso">
          {AGENT_PIPELINE.map((step, index) => {
            const done = currentPipeline > index;
            const active = currentPipeline === index;
            return (
              <li
                key={step}
                className={[
                  'ca-tx-agent-view__pipe',
                  done ? 'is-done' : '',
                  active ? 'is-active' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <span>{AGENT_PIPELINE_LABELS[step]}</span>
              </li>
            );
          })}
        </ol>
      ) : (
        <Badge bg="danger">{STATUS_LABELS[tx.status]}</Badge>
      )}

      <section className="ca-tx-agent-view__route" aria-label="Ruta de mediación">
        <div className="ca-tx-agent-view__stop">
          <span className="ca-tx-agent-view__stop-icon" aria-hidden>
            <Package size={16} strokeWidth={1.75} />
          </span>
          <div>
            <span className="ca-tx-agent-view__stop-label">Retiro · vendedor</span>
            <span className="ca-tx-agent-view__stop-value">
              <MapPin size={13} aria-hidden />
              {placeLabel(tx.party?.seller?.meetingLocation?.label)}
            </span>
          </div>
        </div>
        <div className="ca-tx-agent-view__stop">
          <span className="ca-tx-agent-view__stop-icon is-delivery" aria-hidden>
            <PackageCheck size={16} strokeWidth={1.75} />
          </span>
          <div>
            <span className="ca-tx-agent-view__stop-label">Entrega · comprador</span>
            <span className="ca-tx-agent-view__stop-value">
              <MapPin size={13} aria-hidden />
              {placeLabel(tx.party?.buyer?.meetingLocation?.label)}
            </span>
          </div>
        </div>
      </section>

      {(tx.party?.seller?.conditionsSummary ||
        tx.party?.buyer?.conditionsSummary ||
        tx.returnInstructions) && (
        <section className="ca-tx-agent-view__notes">
          {tx.party?.seller?.conditionsSummary ? (
            <article className="ca-tx-agent-view__note">
              <h2>Instrucciones del vendedor</h2>
              <p>{tx.party.seller.conditionsSummary}</p>
            </article>
          ) : null}
          {tx.party?.buyer?.conditionsSummary ? (
            <article className="ca-tx-agent-view__note">
              <h2>Instrucciones del comprador</h2>
              <p>{tx.party.buyer.conditionsSummary}</p>
            </article>
          ) : null}
          {tx.returnInstructions ? (
            <article className="ca-tx-agent-view__note ca-tx-agent-view__note--accent">
              <h2>Si hay devolución</h2>
              <p>{tx.returnInstructions}</p>
            </article>
          ) : null}
        </section>
      )}

      {tx.product ? (
        <section className="ca-tx-agent-view__product">
          <h2>{tx.product.title}</h2>
          {tx.product.description ? <p>{tx.product.description}</p> : null}
          {productImages.length ? (
            <ul className="ca-tx-agent-view__thumbs">
              {productImages.map((img, index) => (
                <li key={`${index}-${img.url}`}>
                  <button
                    type="button"
                    onClick={() => onGallery(index)}
                    aria-label={`Ampliar foto ${index + 1}`}
                  >
                    <img src={img.url} alt={img.alt || `Foto ${index + 1}`} />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {checklistBlocks.map((block, blockIndex) => (
        <AgentChecklistPanel
          key={block.key}
          title={block.title}
          items={block.items}
          canToggle={canToggle}
          lead={
            canToggle
              ? 'Marcá lo que verifiques al retirar el producto del vendedor.'
              : tx.agentVerification
                ? 'Verificación cerrada.'
                : 'Disponible después del pago protegido.'
          }
          pendingItemId={
            toggleChecklist.isPending ? (toggleChecklist.variables?.itemId ?? null) : null
          }
          onToggle={(itemId, done) => {
            void toggleChecklist
              .mutateAsync({ itemId, done, side: block.side })
              .catch((err) => {
                toast.error(getApiErrorMessage(err, 'No se pudo actualizar el checklist.'));
              });
          }}
          showFinalize={blockIndex === checklistBlocks.length - 1 && allChecklistItems.length > 0}
          finalizePending={finalize.isPending}
          verificationDone={Boolean(tx.agentVerification)}
          verificationPassed={tx.agentVerification?.allPassed}
          finalizeAllPassed={allChecklistPassed}
          onFinalize={onFinalize}
        />
      ))}

      {buyerAccepted ? (
        <section className="ca-tx-agent-view__delivery">
          <h2>Entrega al comprador</h2>
          <p>
            {agentDeliveryDone
              ? buyerArrivalDone
                ? 'Entrega y arribo confirmados. La operación está completa.'
                : 'Ya confirmaste la entrega. Esperamos la confirmación de arribo del comprador.'
              : 'El comprador aceptó el producto. Llevalo al punto de entrega y confirmá cuando se lo entregues.'}
          </p>
          {canConfirmDelivery ? (
            <>
              <DeliveryConfirmationHint
                showDeadline={!agentDeliveryDone && Boolean(tx.deliveryConfirmation?.autoReleaseAt)}
                autoReleaseAt={tx.deliveryConfirmation?.autoReleaseAt}
              />
              <Button
                type="button"
                className="ca-btn-cta"
                disabled={confirmDelivery.isPending}
                onClick={() => setDeliveryConfirmOpen(true)}
              >
                <PackageCheck size={16} strokeWidth={1.75} aria-hidden />
                Confirmar entrega del producto
              </Button>
            </>
          ) : null}
          {agentDeliveryDone ? (
            <p className="ca-tx-agent-view__delivery-done mb-0">
              <CheckCircle2 size={16} strokeWidth={1.75} aria-hidden />
              Entrega confirmada
            </p>
          ) : null}
        </section>
      ) : null}

      {canWithdraw ? (
        <div className="ca-tx-agent-view__exit">
          <Button
            type="button"
            variant="outline-danger"
            size="sm"
            disabled={withdrawing}
            onClick={onWithdraw}
          >
            <LogOut size={15} strokeWidth={1.75} aria-hidden />
            {withdrawing ? 'Procesando…' : 'Solicitar salida'}
          </Button>
        </div>
      ) : null}

      {tx.status === 'COMPLETED' ? <ReviewFormPanel transactionCode={tx.code} /> : null}

      <OperationHistoryAccordion
        tx={tx}
        upcoming={
          tx.status === 'CANCELLED' || tx.status === 'DISPUTED' || tx.status === 'COMPLETED'
            ? null
            : !tx.agentVerification
              ? {
                  title: 'Verificación',
                  detail: 'Retirá el producto del vendedor y completá el checklist.',
                }
              : !buyerAccepted
                ? {
                    title: 'Decisión del comprador',
                    detail: 'Esperamos que el comprador acepte o rechace tras tu verificación.',
                  }
                : !agentDeliveryDone || !buyerArrivalDone
                  ? {
                      title: 'Entrega',
                      detail:
                        'Llevá el producto al comprador y confirmá la entrega cuando se lo entregues.',
                    }
                  : null
        }
      />

      {galleryIndex != null && productImages[galleryIndex] ? (
        <PhotoLightbox
          images={productImages}
          index={galleryIndex}
          open
          onClose={onCloseGallery}
          onIndexChange={onGallery}
        />
      ) : null}

      {finalize.isPending ? (
        <div className="visually-hidden" role="status">
          <Spinner animation="border" size="sm" /> Finalizando…
        </div>
      ) : null}

      <Modal
        show={deliveryConfirmOpen}
        onHide={() => (!confirmDelivery.isPending ? setDeliveryConfirmOpen(false) : undefined)}
        centered
      >
        <Modal.Header closeButton={!confirmDelivery.isPending}>
          <Modal.Title>Confirmar entrega</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="mb-0">
            Confirmá solo si ya entregaste el producto al comprador. Cuando el comprador también
            confirme el arribo, se liberarán los fondos.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="outline-secondary"
            disabled={confirmDelivery.isPending}
            onClick={() => setDeliveryConfirmOpen(false)}
          >
            Volver
          </Button>
          <Button
            className="ca-btn-cta"
            disabled={confirmDelivery.isPending}
            onClick={() => void onConfirmDelivery()}
          >
            {confirmDelivery.isPending ? (
              <>
                <Spinner size="sm" animation="border" className="me-2" />
                Confirmando…
              </>
            ) : (
              'Confirmar entrega'
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
