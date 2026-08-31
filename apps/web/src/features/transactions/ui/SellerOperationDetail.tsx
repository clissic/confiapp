import { Alert, Badge, Button, Spinner } from 'react-bootstrap';
import {
  Copy,
  Link2,
  MapPin,
  Package,
  RefreshCw,
  Search,
  Share2,
  ShieldCheck,
} from 'lucide-react';

import { ReviewFormPanel } from '@/features/reputation';
import { formatDateTime, formatOperationMoney } from '@/shared/lib/money';
import {
  STATUS_LABELS,
  type Transaction,
  type TransactionStatus,
} from '../model/types';
import { AgentChecklistPanel } from './AgentChecklistPanel';
import { OperationHistoryAccordion } from './OperationHistoryAccordion';
import { PhotoLightbox } from './PhotoLightbox';

const SELLER_PIPELINE = [
  'WAITING_PARTICIPANT',
  'ACCEPTED',
  'FUNDED',
  'IN_PROGRESS',
  'COMPLETED',
] as const satisfies readonly TransactionStatus[];

const SELLER_PIPELINE_LABELS: Record<(typeof SELLER_PIPELINE)[number], string> = {
  WAITING_PARTICIPANT: 'Esperando',
  ACCEPTED: 'Aceptada',
  FUNDED: 'Pago',
  IN_PROGRESS: 'En curso',
  COMPLETED: 'Listo',
};

function pipelineIndex(status: TransactionStatus): number {
  if (status === 'CREATED') return 0;
  if (status === 'PENDING_BUYER_CONFIRM') return 1;
  const idx = SELLER_PIPELINE.indexOf(status as (typeof SELLER_PIPELINE)[number]);
  return idx >= 0 ? idx : status === 'CANCELLED' || status === 'DISPUTED' ? -1 : 0;
}

function placeLabel(label?: string): string {
  return label?.trim() || 'A coordinar';
}

function upcomingForSeller(tx: Transaction, pendingPayment: boolean) {
  if (tx.status === 'CANCELLED' || tx.status === 'DISPUTED' || tx.status === 'COMPLETED') {
    return null;
  }
  if (tx.status === 'WAITING_PARTICIPANT' || tx.status === 'CREATED') {
    return {
      title: 'Esperando',
      detail: 'A la espera de que el comprador se una con el enlace de invitación.',
    };
  }
  if (tx.status === 'PENDING_BUYER_CONFIRM') {
    return {
      title: 'Revisión',
      detail: 'A la espera de que el comprador acepte o cancele tus cambios.',
    };
  }
  if (tx.status === 'ACCEPTED') {
    return pendingPayment
      ? {
          title: 'Verificación del pago',
          detail: 'El comprador ya pagó. ConfiApp está confirmando la transferencia.',
        }
      : {
          title: 'Pago',
          detail: 'A la espera de que el comprador pague. El dinero queda en resguardo.',
        };
  }
  if (tx.status === 'FUNDED' || tx.status === 'IN_PROGRESS') {
    if (!tx.agentVerification) {
      return {
        title: 'En curso',
        detail: 'El Agente retira y verifica el producto. Después el comprador decide.',
      };
    }
    if (tx.agentVerification.buyerDecision === 'REJECTED') {
      return null;
    }
    if (tx.agentVerification.buyerDecision !== 'ACCEPTED') {
      return {
        title: 'En curso',
        detail: 'El Agente ya verificó. Esperamos la decisión del comprador.',
      };
    }
    const arrival = Boolean(tx.deliveryConfirmation?.buyerArrivalConfirmedAt);
    const delivery = Boolean(tx.deliveryConfirmation?.agentDeliveryConfirmedAt);
    if (!arrival || !delivery) {
      return {
        title: 'Entrega',
        detail: 'El producto va hacia el comprador. Al confirmar arribo y entrega se liberan fondos.',
      };
    }
  }
  return null;
}

/** Vista minimalista del detalle para el vendedor. */
export function SellerOperationDetail({
  tx,
  error,
  pendingPaymentConfirmation,
  lookingForAgent,
  showInvitePanel,
  shareUrl,
  refreshPending,
  onRefresh,
  onCopyLink,
  onShare,
  onGallery,
  galleryIndex,
  onCloseGallery,
}: {
  tx: Transaction;
  error: string | null;
  pendingPaymentConfirmation: boolean;
  lookingForAgent: boolean;
  showInvitePanel: boolean;
  shareUrl?: string;
  refreshPending: boolean;
  onRefresh: () => void;
  onCopyLink: () => void;
  onShare: () => void;
  onGallery: (index: number) => void;
  galleryIndex: number | null;
  onCloseGallery: () => void;
}) {
  const currentPipeline = pipelineIndex(tx.status);
  const productImages = tx.product?.images ?? [];
  const checklist =
    tx.party?.seller?.checklist?.length
      ? tx.party.seller.checklist
      : !tx.party?.buyer?.checklist?.length
        ? (tx.conditions.checklist ?? [])
        : [];
  const pickupLabel = placeLabel(tx.party?.seller?.meetingLocation?.label);
  const ownInstructions = tx.party?.seller?.conditionsSummary || tx.conditions.summary;
  const upcoming = upcomingForSeller(tx, pendingPaymentConfirmation);

  return (
    <div className="ca-tx ca-tx--detail ca-tx-agent-view">
      <header className="ca-tx-agent-view__hero">
        <p className="ca-tx-agent-view__code">{tx.code}</p>
        <h1 className="ca-tx-agent-view__title">{tx.title}</h1>
        <div className="ca-tx-agent-view__meta">
          <Badge bg="primary">{STATUS_LABELS[tx.status]}</Badge>
          <strong>{formatOperationMoney(tx.amountCents, tx.currency)}</strong>
        </div>
        {tx.operationDeadlineAt ? (
          <p className="ca-tx-buyer-view__deadline mb-0">
            Plazo hasta {formatDateTime(tx.operationDeadlineAt)}
          </p>
        ) : null}
      </header>

      {error ? <Alert variant="danger">{error}</Alert> : null}

      {tx.status !== 'CANCELLED' && tx.status !== 'DISPUTED' ? (
        <ol className="ca-tx-agent-view__pipeline" aria-label="Progreso">
          {SELLER_PIPELINE.map((step, index) => {
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
                <span>{SELLER_PIPELINE_LABELS[step]}</span>
              </li>
            );
          })}
        </ol>
      ) : (
        <Badge bg="danger">{STATUS_LABELS[tx.status]}</Badge>
      )}

      {lookingForAgent ? (
        <section className="ca-tx-buyer-view__banner">
          <Search size={16} strokeWidth={1.75} aria-hidden />
          <div>
            <strong>Buscando nuevo agente</strong>
            <p className="mb-0">El intermediario anterior salió. El pago del comprador sigue protegido.</p>
          </div>
        </section>
      ) : null}

      {tx.status === 'ACCEPTED' ? (
        <section className="ca-tx-buyer-view__cta">
          <p className="ca-tx-buyer-view__cta-kicker">
            <ShieldCheck size={15} strokeWidth={1.75} aria-hidden />
            Pago protegido
          </p>
          <h2>
            {pendingPaymentConfirmation
              ? 'Esperando confirmación del pago'
              : 'Esperando el pago del comprador'}
          </h2>
          <p className="mb-0">
            {pendingPaymentConfirmation
              ? 'El comprador ya envió el comprobante. Estamos verificando la transferencia.'
              : 'Cuando pague, el dinero queda en resguardo hasta confirmar la entrega.'}
          </p>
        </section>
      ) : null}

      {tx.status === 'PENDING_BUYER_CONFIRM' ? (
        <section className="ca-tx-buyer-view__cta">
          <p className="ca-tx-buyer-view__cta-kicker">Revisión</p>
          <h2>Esperando al comprador</h2>
          <p className="mb-0">
            Ya enviaste tu versión. Cuando acepte, la operación pasa a aceptada.
          </p>
        </section>
      ) : null}

      {showInvitePanel ? (
        <section className="ca-tx-buyer-view__invite">
          <p className="ca-tx-buyer-view__cta-kicker">
            <Link2 size={15} strokeWidth={1.75} aria-hidden />
            Invitación
          </p>
          <h2>Compartí el enlace con el comprador</h2>
          {shareUrl ? (
            <>
              <p className="ca-tx-buyer-view__invite-url">{shareUrl}</p>
              <div className="ca-tx-buyer-view__invite-actions">
                <Button type="button" className="ca-btn-cta" onClick={onCopyLink}>
                  <Copy size={15} aria-hidden />
                  Copiar
                </Button>
                <Button type="button" variant="outline-primary" onClick={onShare}>
                  <Share2 size={15} aria-hidden />
                  Compartir
                </Button>
                <Button
                  type="button"
                  variant="outline-secondary"
                  disabled={refreshPending}
                  onClick={onRefresh}
                >
                  {refreshPending ? (
                    <Spinner size="sm" animation="border" />
                  ) : (
                    <RefreshCw size={15} aria-hidden />
                  )}
                  Regenerar
                </Button>
              </div>
            </>
          ) : (
            <Button
              type="button"
              variant="outline-secondary"
              disabled={refreshPending}
              onClick={onRefresh}
            >
              {refreshPending ? (
                <Spinner size="sm" animation="border" className="me-2" />
              ) : null}
              Regenerar enlace
            </Button>
          )}
        </section>
      ) : null}

      <section className="ca-tx-agent-view__route" aria-label="Punto de retiro">
        <div className="ca-tx-agent-view__stop">
          <span className="ca-tx-agent-view__stop-icon" aria-hidden>
            <Package size={16} strokeWidth={1.75} />
          </span>
          <div>
            <span className="ca-tx-agent-view__stop-label">Retiro · tu punto</span>
            <span className="ca-tx-agent-view__stop-value">
              <MapPin size={13} aria-hidden />
              {pickupLabel}
            </span>
          </div>
        </div>
      </section>

      {ownInstructions ? (
        <section className="ca-tx-agent-view__notes">
          <article className="ca-tx-agent-view__note">
            <h2>Tus instrucciones para el Agente</h2>
            <p>{ownInstructions}</p>
          </article>
          {tx.returnInstructions ? (
            <article className="ca-tx-agent-view__note ca-tx-agent-view__note--accent">
              <h2>Si hay devolución</h2>
              <p>{tx.returnInstructions}</p>
            </article>
          ) : null}
        </section>
      ) : tx.returnInstructions ? (
        <section className="ca-tx-agent-view__notes">
          <article className="ca-tx-agent-view__note ca-tx-agent-view__note--accent">
            <h2>Si hay devolución</h2>
            <p>{tx.returnInstructions}</p>
          </article>
        </section>
      ) : null}

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

      {checklist.length ? (
        <AgentChecklistPanel
          title="Tu checklist para el Agente"
          items={checklist}
          canToggle={false}
          lead="El Agente usa esta guía al retirar el producto."
          onToggle={() => undefined}
        />
      ) : null}

      {tx.agentVerification ? (
        <section className="ca-tx-buyer-view__cta">
          <p className="ca-tx-buyer-view__cta-kicker">Verificación</p>
          <h2>
            {tx.agentVerification.allPassed
              ? 'El Agente verificó el producto'
              : 'Verificación con observaciones'}
          </h2>
          <p className="mb-0">
            {tx.agentVerification.buyerDecision === 'ACCEPTED'
              ? 'El comprador aceptó. El Agente lleva el producto al punto de entrega.'
              : tx.agentVerification.buyerDecision === 'REJECTED'
                ? 'El comprador rechazó el producto y se canceló la compra.'
                : 'Esperamos la decisión del comprador sobre el producto.'}
          </p>
          {tx.agentVerification.note ? (
            <blockquote className="ca-tx-product-decision__note mt-2 mb-0">
              <span className="ca-tx-product-decision__note-label">Nota del Agente</span>
              <p>{tx.agentVerification.note}</p>
            </blockquote>
          ) : null}
        </section>
      ) : null}

      {tx.status === 'COMPLETED' ? <ReviewFormPanel transactionCode={tx.code} /> : null}

      <OperationHistoryAccordion tx={tx} upcoming={upcoming} />

      {galleryIndex != null && productImages[galleryIndex] ? (
        <PhotoLightbox
          images={productImages}
          index={galleryIndex}
          open
          onClose={onCloseGallery}
          onIndexChange={onGallery}
        />
      ) : null}
    </div>
  );
}
