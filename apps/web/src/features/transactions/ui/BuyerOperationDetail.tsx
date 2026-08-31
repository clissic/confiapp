import { Alert, Badge, Button, Spinner } from 'react-bootstrap';
import {
  Copy,
  Link2,
  MapPin,
  PackageCheck,
  RefreshCw,
  Search,
  Share2,
  ShieldCheck,
} from 'lucide-react';

import { ReviewFormPanel } from '@/features/reputation';
import { formatDateTime, formatOperationMoney } from '@/shared/lib/money';
import {
  CATEGORY_LABELS,
  CONDITION_LABELS,
  STATUS_LABELS,
  type ProductCategory,
  type ProductCondition,
  type Transaction,
  type TransactionStatus,
} from '../model/types';
import { AgentChecklistPanel } from './AgentChecklistPanel';
import { BuyerProductDecisionPanel } from './BuyerProductDecisionPanel';
import { BuyerDeliveryDisputePanel } from './BuyerDeliveryDisputePanel';
import { OperationHistoryAccordion } from './OperationHistoryAccordion';
import { PhotoLightbox } from './PhotoLightbox';

const BUYER_PIPELINE = [
  'WAITING_PARTICIPANT',
  'ACCEPTED',
  'FUNDED',
  'IN_PROGRESS',
  'COMPLETED',
] as const satisfies readonly TransactionStatus[];

const BUYER_PIPELINE_LABELS: Record<(typeof BUYER_PIPELINE)[number], string> = {
  WAITING_PARTICIPANT: 'Esperando',
  ACCEPTED: 'Aceptada',
  FUNDED: 'Pago',
  IN_PROGRESS: 'En curso',
  COMPLETED: 'Listo',
};

const CHANGE_FIELD_LABELS: Record<string, string> = {
  title: 'Título',
  description: 'Descripción',
  price: 'Precio',
  condition: 'Condición',
  category: 'Categoría',
  images: 'Fotos',
  feePayer: 'Quién paga la comisión',
};

function pipelineIndex(status: TransactionStatus): number {
  if (status === 'CREATED') return 0;
  if (status === 'PENDING_BUYER_CONFIRM') return 1;
  const idx = BUYER_PIPELINE.indexOf(status as (typeof BUYER_PIPELINE)[number]);
  return idx >= 0 ? idx : status === 'CANCELLED' || status === 'DISPUTED' ? -1 : 0;
}

function placeLabel(label?: string): string {
  return label?.trim() || 'A coordinar';
}

function formatChangeValue(field: string, raw: string): string {
  const value = raw.trim();
  if (!value || value === '(vacío)' || value === '(ninguna)') {
    if (field === 'images') return 'Sin fotos';
    return 'Sin definir';
  }
  if (field === 'condition') {
    const key = value.toUpperCase() as ProductCondition;
    return CONDITION_LABELS[key] ?? value;
  }
  if (field === 'category') {
    const key = value.toUpperCase() as ProductCategory;
    return CATEGORY_LABELS[key] ?? value;
  }
  return value;
}

/** Vista minimalista del detalle para el comprador. */
export function BuyerOperationDetail({
  tx,
  error,
  pendingPaymentConfirmation,
  buyerTotalCents,
  lookingForAgent,
  showInvitePanel,
  shareUrl,
  refreshPending,
  buyerConfirmPending,
  buyerRejectPending,
  onPayNow,
  onRefresh,
  onCopyLink,
  onShare,
  onBuyerConfirm,
  onBuyerReject,
  onGallery,
  galleryIndex,
  onCloseGallery,
}: {
  tx: Transaction;
  error: string | null;
  pendingPaymentConfirmation: boolean;
  buyerTotalCents?: number;
  lookingForAgent: boolean;
  showInvitePanel: boolean;
  shareUrl?: string;
  refreshPending: boolean;
  buyerConfirmPending: boolean;
  buyerRejectPending: boolean;
  onPayNow: () => void;
  onRefresh: () => void;
  onCopyLink: () => void;
  onShare: () => void;
  onBuyerConfirm: () => void;
  onBuyerReject: () => void;
  onGallery: (index: number) => void;
  galleryIndex: number | null;
  onCloseGallery: () => void;
}) {
  const currentPipeline = pipelineIndex(tx.status);
  const productImages = tx.product?.images ?? [];
  const checklist =
    tx.party?.buyer?.checklist?.length
      ? tx.party.buyer.checklist
      : !tx.party?.seller?.checklist?.length
        ? (tx.conditions.checklist ?? [])
        : [];
  const deliveryLabel = placeLabel(tx.party?.buyer?.meetingLocation?.label);
  const ownInstructions = tx.party?.buyer?.conditionsSummary || tx.conditions.summary;

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
          {BUYER_PIPELINE.map((step, index) => {
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
                <span>{BUYER_PIPELINE_LABELS[step]}</span>
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
            <p className="mb-0">El intermediario anterior salió. Tu pago sigue protegido.</p>
          </div>
        </section>
      ) : null}

      {tx.status === 'ACCEPTED' ? (
        pendingPaymentConfirmation ? (
          <section className="ca-tx-buyer-view__cta">
            <p className="ca-tx-buyer-view__cta-kicker">
              <ShieldCheck size={15} strokeWidth={1.75} aria-hidden />
              Pago protegido
            </p>
            <h2>Esperando confirmación del pago</h2>
            <p className="mb-0">
              Ya recibimos tu comprobante. Cuando se verifique, el dinero queda en resguardo.
            </p>
          </section>
        ) : (
          <section className="ca-tx-buyer-view__cta ca-tx-buyer-view__cta--action">
            <p className="ca-tx-buyer-view__cta-kicker">
              <ShieldCheck size={15} strokeWidth={1.75} aria-hidden />
              Pago protegido
            </p>
            <h2>Listo para pagar</h2>
            <p>
              Completá la transferencia. Verificamos el comprobante antes de habilitar el trabajo.
            </p>
            <p className="ca-tx-buyer-view__cta-amount">
              Total:{' '}
              <strong>
                {formatOperationMoney(buyerTotalCents ?? tx.amountCents, tx.currency)}
              </strong>
            </p>
            <Button type="button" className="ca-btn-cta" onClick={onPayNow}>
              Pagar ahora
            </Button>
          </section>
        )
      ) : null}

      {tx.status === 'PENDING_BUYER_CONFIRM' ? (
        <section className="ca-tx-buyer-view__reconfirm">
          <h2>El vendedor actualizó la propuesta</h2>
          <p>Compará los cambios. Podés aceptar y seguir, o cancelar la operación.</p>
          {tx.pendingBuyerChanges?.length ? (
            <ul className="ca-tx-buyer-view__changes">
              {tx.pendingBuyerChanges.map((change) => (
                <li key={`${change.field}-${change.from}-${change.to}`}>
                  <span>{CHANGE_FIELD_LABELS[change.field] ?? change.field}</span>
                  <strong>
                    {formatChangeValue(change.field, change.from)} →{' '}
                    {formatChangeValue(change.field, change.to)}
                  </strong>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="ca-tx-buyer-view__reconfirm-actions">
            <Button
              type="button"
              className="ca-btn-cta"
              disabled={buyerConfirmPending || buyerRejectPending}
              onClick={onBuyerConfirm}
            >
              {buyerConfirmPending ? 'Aceptando…' : 'Aceptar y continuar'}
            </Button>
            <Button
              type="button"
              variant="outline-danger"
              disabled={buyerConfirmPending || buyerRejectPending}
              onClick={onBuyerReject}
            >
              {buyerRejectPending ? 'Cancelando…' : 'Cancelar operación'}
            </Button>
          </div>
        </section>
      ) : null}

      {showInvitePanel ? (
        <section className="ca-tx-buyer-view__invite">
          <p className="ca-tx-buyer-view__cta-kicker">
            <Link2 size={15} strokeWidth={1.75} aria-hidden />
            Invitación
          </p>
          <h2>Compartí el enlace con el vendedor</h2>
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

      <section className="ca-tx-agent-view__route" aria-label="Tu punto de entrega">
        <div className="ca-tx-agent-view__stop">
          <span className="ca-tx-agent-view__stop-icon is-delivery" aria-hidden>
            <PackageCheck size={16} strokeWidth={1.75} />
          </span>
          <div>
            <span className="ca-tx-agent-view__stop-label">Entrega · tu punto</span>
            <span className="ca-tx-agent-view__stop-value">
              <MapPin size={13} aria-hidden />
              {deliveryLabel}
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

      {tx.agentVerification ? <BuyerProductDecisionPanel tx={tx} /> : null}

      <BuyerDeliveryDisputePanel tx={tx} />

      {tx.status === 'COMPLETED' ? <ReviewFormPanel transactionCode={tx.code} /> : null}

      <OperationHistoryAccordion
        tx={tx}
        upcoming={
          tx.status === 'CANCELLED' || tx.status === 'DISPUTED' || tx.status === 'COMPLETED'
            ? null
            : tx.status === 'ACCEPTED'
              ? pendingPaymentConfirmation
                ? {
                    title: 'Verificación del pago',
                    detail:
                      'Ya pagaste. ConfiApp está confirmando que la transferencia sea correcta.',
                  }
                : {
                    title: 'Pago',
                    detail: 'Completá el pago protegido para habilitar el trabajo del Agente.',
                  }
              : tx.status === 'FUNDED' || tx.status === 'IN_PROGRESS'
                ? !tx.agentVerification
                  ? {
                      title: 'En curso',
                      detail: 'El Agente retira y verifica el producto en el punto del vendedor.',
                    }
                  : tx.agentVerification.buyerDecision === 'ACCEPTED' &&
                      !(
                        tx.deliveryConfirmation?.buyerArrivalConfirmedAt &&
                        tx.deliveryConfirmation?.agentDeliveryConfirmedAt
                      )
                    ? {
                        title: 'Entrega',
                        detail:
                          'Cuando recibas el producto, confirmá el arribo. El Agente confirma la entrega.',
                      }
                    : null
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
    </div>
  );
}
