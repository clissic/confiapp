import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Alert, Badge, Button, Spinner } from 'react-bootstrap';
import { motion } from 'framer-motion';
import { Copy, Link2, MapPin, RefreshCw, Share2 } from 'lucide-react';

import { formatDateTime, formatOperationMoney } from '@/shared/lib/money';
import { useAuth } from '@/features/auth/ui/AuthProvider';
import { useAppToast } from '@/shared/ui';
import { useRefreshInvite, useToggleChecklistItem, useTransaction, useBuyerConfirmChanges, useBuyerRejectChanges } from '../hooks/useTransactions';
import {
  CATEGORY_LABELS,
  CONDITION_LABELS,
  INITIATOR_LABELS,
  STATUS_LABELS,
  type ProductCategory,
  type ProductCondition,
  type TransactionStatus,
} from '../model/types';
import { ReviewFormPanel } from '@/features/reputation';
import { AgentChecklistPanel } from './AgentChecklistPanel';
import { PhotoLightbox } from './PhotoLightbox';
import '../styles/transactions.css';

const STATE_PIPELINE = [
  'CREATED',
  'WAITING_PARTICIPANT',
  'PENDING_BUYER_CONFIRM',
  'ACCEPTED',
  'FUNDED',
  'IN_PROGRESS',
  'COMPLETED',
] as const satisfies readonly TransactionStatus[];

const PIPELINE_SHORT_LABELS: Record<(typeof STATE_PIPELINE)[number], string> = {
  CREATED: 'Creada',
  WAITING_PARTICIPANT: 'Esperando',
  PENDING_BUYER_CONFIRM: 'Reconfirmación',
  ACCEPTED: 'Aceptada',
  FUNDED: 'Fondeada',
  IN_PROGRESS: 'En curso',
  COMPLETED: 'Completada',
};

const CHANGE_FIELD_LABELS: Record<string, string> = {
  title: 'Título',
  description: 'Descripción',
  price: 'Precio',
  condition: 'Condición',
  category: 'Categoría',
  images: 'Fotos',
};

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

function sameText(a?: string | null, b?: string | null): boolean {
  return (
    (a ?? '').trim().replace(/\s+/g, ' ').toLowerCase() ===
    (b ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
  );
}

function pipelineIndex(status: TransactionStatus): number {
  if (status === 'CANCELLED' || status === 'DISPUTED') return -1;
  return (STATE_PIPELINE as readonly TransactionStatus[]).indexOf(status);
}

export function TransactionDetailPage() {
  const toast = useAppToast();
  const { user } = useAuth();
  const { code } = useParams<{ code: string }>();
  const location = useLocation();
  const state = location.state as {
    shareUrl?: string;
    justCreated?: boolean;
    sellerConfirmed?: boolean;
    pendingBuyerConfirm?: boolean;
    buyerAccepted?: boolean;
    initiatedBySeller?: boolean;
    agentAccepted?: boolean;
  } | null;
  const { data, isLoading, isError } = useTransaction(code);
  const refresh = useRefreshInvite();
  const toggleChecklist = useToggleChecklistItem(code);
  const buyerConfirm = useBuyerConfirmChanges(code);
  const buyerReject = useBuyerRejectChanges(code);
  const [shareUrl, setShareUrl] = useState<string | undefined>(state?.shareUrl);
  const [error, setError] = useState<string | null>(null);
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null);

  useEffect(() => {
    if (state?.agentAccepted) {
      toast.success('Oferta aceptada. Usá el checklist como guía de la entrega.');
    } else if (state?.buyerAccepted) {
      toast.success('Compra aceptada. Estado actualizado a Aceptada — pendiente de fondeo.');
    } else if (state?.sellerConfirmed) {
      toast.success(
        state.pendingBuyerConfirm
          ? 'Venta enviada. El comprador debe aceptar los cambios.'
          : 'Venta confirmada. Estado actualizado a Aceptada — pendiente de fondeo.',
      );
    } else if (state?.justCreated) {
      toast.success(
        state.initiatedBySeller
          ? 'Operación creada. Compartí el enlace con el comprador.'
          : 'Operación creada. Compartí el enlace con el vendedor.',
      );
    }
    // Solo al montar (feedback inicial desde location.state).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (data?.data.invite.shareUrl) {
      setShareUrl(data.data.invite.shareUrl);
    }
  }, [data?.data.invite.shareUrl]);

  const tx = data?.data;
  const productImages = useMemo(
    () =>
      (tx?.product?.images ?? []).map((img) => ({
        url: img.url,
        alt: img.alt || tx?.product?.title || tx?.title,
      })),
    [tx?.product?.images, tx?.product?.title, tx?.title],
  );

  if (isLoading) {
    return (
      <div className="ca-tx ca-tx--loading">
        <Spinner animation="border" />
        <span>Cargando operación…</span>
      </div>
    );
  }

  if (isError || !tx) {
    return (
      <Alert variant="danger">
        No se encontró la operación.{' '}
        <Link to="/operaciones">Volver al listado</Link>
      </Alert>
    );
  }

  const hasCounterparty = tx.participants.some(
    (p) => p.role === 'COUNTERPARTY' && p.status === 'ACCEPTED',
  );
  const isAssignedAgent = Boolean(
    user?.id &&
      tx.participants.some(
        (p) =>
          p.userId === user.id &&
          p.role === 'INTERMEDIARY' &&
          p.status === 'ACCEPTED',
      ),
  );
  const currentPipeline = pipelineIndex(tx.status);
  const currentStepLabel =
    currentPipeline >= 0
      ? PIPELINE_SHORT_LABELS[STATE_PIPELINE[currentPipeline]!]
      : STATUS_LABELS[tx.status];

  const copyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Enlace copiado.');
    } catch {
      setError('No se pudo copiar al portapapeles');
    }
  };

  const shareNative = async () => {
    if (!shareUrl || !navigator.share) {
      await copyLink();
      return;
    }
    try {
      await navigator.share({
        title: `ConfiApp · ${tx.title}`,
        text: `Unite a la operación ${tx.code}`,
        url: shareUrl,
      });
    } catch {
      /* usuario canceló */
    }
  };

  const onRefresh = async () => {
    setError(null);
    try {
      const result = await refresh.mutateAsync(tx.code);
      setShareUrl(result.data.invite.shareUrl);
      toast.success('Nuevo enlace generado. El anterior dejó de ser válido.');
    } catch {
      setError('No se pudo regenerar el enlace.');
    }
  };

  const onBuyerConfirm = async () => {
    setError(null);
    try {
      await buyerConfirm.mutateAsync();
      toast.success('Cambios aceptados. La operación quedó aceptada.');
    } catch {
      setError('No se pudieron aceptar los cambios.');
    }
  };

  const onBuyerReject = async () => {
    setError(null);
    try {
      await buyerReject.mutateAsync();
      toast.success('Operación cancelada.');
    } catch {
      setError('No se pudo cancelar la operación.');
    }
  };

  return (
    <div className="ca-tx ca-tx--detail">
      <header className="ca-tx-detail-hero">
        <div className="ca-tx-detail-hero__main">
          <p className="ca-tx-detail-hero__code">{tx.code}</p>
          <h1 className="ca-tx-detail-hero__title">{tx.title}</h1>
          <div className="ca-tx-detail-hero__badges">
            <Badge bg="primary">{STATUS_LABELS[tx.status]}</Badge>
            <Badge bg="secondary">{INITIATOR_LABELS[tx.initiatedBy ?? 'BUYER']}</Badge>
          </div>
          {tx.description ? (
            <p className="ca-tx-detail-hero__desc">{tx.description}</p>
          ) : null}
          {tx.operationDeadlineAt ? (
            <p className="ca-tx-detail-hero__desc mb-0">
              Plazo operativo hasta {formatDateTime(tx.operationDeadlineAt)}
            </p>
          ) : null}
        </div>
        <div className="ca-tx-detail-hero__amount">
          <span>Monto</span>
          <strong>{formatOperationMoney(tx.amountCents, tx.currency)}</strong>
        </div>
      </header>

      {error ? <Alert variant="danger">{error}</Alert> : null}

      {tx.status === 'PENDING_BUYER_CONFIRM' ? (
        <section className="ca-tx-panel ca-tx-reconfirm">
          {tx.viewerRole === 'BUYER' ? (
            <>
              <header className="ca-tx-reconfirm__head">
                <div>
                  <p className="ca-tx-reconfirm__kicker">Revisión requerida</p>
                  <h2 className="ca-tx-reconfirm__title">El vendedor actualizó la propuesta</h2>
                  <p className="ca-tx-reconfirm__lead">
                    Compará lo que pediste con lo que ofreció. Podés aceptar y seguir, o cancelar.
                  </p>
                </div>
              </header>

              {tx.pendingBuyerChanges?.length ? (
                <div className="ca-tx-reconfirm__grid">
                  {tx.pendingBuyerChanges.map((change) => {
                    const isImages = change.field === 'images';
                    return (
                      <article
                        key={`${change.field}-${change.from}-${change.to}`}
                        className="ca-tx-reconfirm__item"
                      >
                        <h3>{CHANGE_FIELD_LABELS[change.field] ?? change.field}</h3>
                        <div className="ca-tx-reconfirm__compare">
                          <div className="ca-tx-reconfirm__side ca-tx-reconfirm__side--from">
                            <span className="ca-tx-reconfirm__side-label">Tu propuesta</span>
                            <strong>{formatChangeValue(change.field, change.from)}</strong>
                          </div>
                          <span className="ca-tx-reconfirm__arrow" aria-hidden>
                            →
                          </span>
                          <div className="ca-tx-reconfirm__side ca-tx-reconfirm__side--to">
                            <span className="ca-tx-reconfirm__side-label">Oferta del vendedor</span>
                            <strong>{formatChangeValue(change.field, change.to)}</strong>
                          </div>
                        </div>
                        {isImages && productImages.length ? (
                          <ul className="ca-tx-reconfirm__thumbs">
                            {productImages.slice(0, 4).map((img, index) => (
                              <li key={`${index}-${img.url}`}>
                                <button
                                  type="button"
                                  onClick={() => setGalleryIndex(index)}
                                  aria-label={`Ampliar foto ${index + 1}`}
                                >
                                  <img src={img.url} alt={img.alt || `Foto ${index + 1}`} />
                                </button>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              ) : (
                <p className="ca-tx-reconfirm__lead mb-0">
                  Hay cambios pendientes de tu confirmación.
                </p>
              )}

              <div className="ca-tx-reconfirm__actions">
                <Button
                  className="ca-btn-cta"
                  disabled={buyerConfirm.isPending || buyerReject.isPending}
                  onClick={() => void onBuyerConfirm()}
                >
                  {buyerConfirm.isPending ? 'Aceptando…' : 'Aceptar y continuar'}
                </Button>
                <Button
                  variant="outline-danger"
                  disabled={buyerConfirm.isPending || buyerReject.isPending}
                  onClick={() => void onBuyerReject()}
                >
                  {buyerReject.isPending ? 'Cancelando…' : 'Cancelar operación'}
                </Button>
              </div>
            </>
          ) : tx.viewerRole === 'SELLER' ? (
            <>
              <header className="ca-tx-reconfirm__head">
                <div>
                  <p className="ca-tx-reconfirm__kicker">En espera</p>
                  <h2 className="ca-tx-reconfirm__title">Esperando al comprador</h2>
                  <p className="ca-tx-reconfirm__lead mb-0">
                    Ya enviaste tu versión. Cuando acepte, la operación pasa a aceptada.
                  </p>
                </div>
              </header>
              {tx.pendingBuyerChanges?.length ? (
                <div className="ca-tx-reconfirm__grid">
                  {tx.pendingBuyerChanges.map((change) => (
                    <article
                      key={`${change.field}-${change.from}-${change.to}`}
                      className="ca-tx-reconfirm__item"
                    >
                      <h3>{CHANGE_FIELD_LABELS[change.field] ?? change.field}</h3>
                      <div className="ca-tx-reconfirm__compare">
                        <div className="ca-tx-reconfirm__side ca-tx-reconfirm__side--from">
                          <span className="ca-tx-reconfirm__side-label">Propuesta original</span>
                          <strong>{formatChangeValue(change.field, change.from)}</strong>
                        </div>
                        <span className="ca-tx-reconfirm__arrow" aria-hidden>
                          →
                        </span>
                        <div className="ca-tx-reconfirm__side ca-tx-reconfirm__side--to">
                          <span className="ca-tx-reconfirm__side-label">Tu oferta</span>
                          <strong>{formatChangeValue(change.field, change.to)}</strong>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : null}
            </>
          ) : (
            <>
              <header className="ca-tx-reconfirm__head">
                <div>
                  <p className="ca-tx-reconfirm__kicker">Estado</p>
                  <h2 className="ca-tx-reconfirm__title">Pendiente de confirmación</h2>
                  <p className="ca-tx-reconfirm__lead mb-0">
                    El comprador debe aceptar o cancelar los cambios del vendedor.
                  </p>
                </div>
              </header>
            </>
          )}
        </section>
      ) : null}

      <section className="ca-tx-panel ca-tx-detail-progress">
        <div className="ca-tx-pipeline-wrap">
          {tx.status === 'CANCELLED' || tx.status === 'DISPUTED' ? (
            <Badge bg="danger">{STATUS_LABELS[tx.status]}</Badge>
          ) : (
            <>
              <ol className="ca-tx-pipeline" aria-label="Progreso de la operación">
                {STATE_PIPELINE.map((stepStatus, index) => {
                  const done = currentPipeline > index;
                  const active = currentPipeline === index;
                  return (
                    <li
                      key={stepStatus}
                      className={[
                        'ca-tx-pipeline__item',
                        done ? 'ca-tx-pipeline__item--done' : '',
                        active ? 'ca-tx-pipeline__item--active' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      <span className="ca-tx-pipeline__num">{index + 1}</span>
                      <span className="ca-tx-pipeline__label">
                        {PIPELINE_SHORT_LABELS[stepStatus]}
                      </span>
                    </li>
                  );
                })}
              </ol>
              <p className="ca-tx-pipeline__current" aria-live="polite">
                {currentStepLabel}
              </p>
            </>
          )}
        </div>
      </section>

      <motion.section
        className="ca-tx-panel ca-tx-detail-media"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="ca-tx-detail-media__body">
          {(() => {
            const role = tx.viewerRole;
            const own =
              role === 'BUYER'
                ? tx.party?.buyer
                : role === 'SELLER'
                  ? tx.party?.seller
                  : undefined;
            const otherPublic =
              role === 'BUYER'
                ? tx.party?.seller
                : role === 'SELLER'
                  ? tx.party?.buyer
                  : undefined;

            const productTitle = tx.product?.title;
            const productDesc = tx.product?.description;
            const showOwnProduct =
              Boolean(own?.productTitle || own?.productDescription) &&
              !(
                sameText(own?.productTitle, productTitle) &&
                sameText(own?.productDescription, productDesc)
              );
            const showOtherProduct =
              Boolean(otherPublic?.productTitle || otherPublic?.productDescription) &&
              !(
                sameText(otherPublic?.productTitle, productTitle) &&
                sameText(otherPublic?.productDescription, productDesc)
              ) &&
              !(
                sameText(otherPublic?.productTitle, own?.productTitle) &&
                sameText(otherPublic?.productDescription, own?.productDescription)
              );

            const instructionsSummary =
              own?.conditionsSummary ||
              (role !== 'AGENT' ? tx.conditions.summary : undefined);
            const deliveryLabel = own?.meetingLocation?.label;

            return (
              <>
                <header className="ca-tx-detail-media__top">
                  <div className="ca-tx-detail-media__intro">
                    <p className="ca-tx-detail-media__kicker">Detalle de la operación</p>
                    <h2 className="ca-tx-detail-media__heading">
                      {tx.product?.title || own?.productTitle || otherPublic?.productTitle || tx.title}
                    </h2>
                  </div>
                  <div className="ca-tx-detail-media__visual" aria-hidden="true">
                    <img
                      src="/landing/LandingPage.png"
                      alt=""
                      width={512}
                      height={512}
                      decoding="async"
                    />
                  </div>
                </header>

                {role === 'AGENT' ? (
                  <div className="ca-tx-detail-cards">
                    {tx.party?.buyer?.conditionsSummary ? (
                      <article className="ca-tx-detail-card">
                        <h3>Instrucciones del comprador</h3>
                        <p>{tx.party.buyer.conditionsSummary}</p>
                        {tx.party.buyer.meetingLocation?.label ? (
                          <p className="ca-tx-detail-card__meta">
                            <MapPin size={14} aria-hidden />
                            {tx.party.buyer.meetingLocation.label}
                          </p>
                        ) : null}
                      </article>
                    ) : null}
                    {tx.party?.seller?.conditionsSummary ? (
                      <article className="ca-tx-detail-card">
                        <h3>Instrucciones del vendedor</h3>
                        <p>{tx.party.seller.conditionsSummary}</p>
                        {tx.party.seller.meetingLocation?.label ? (
                          <p className="ca-tx-detail-card__meta">
                            <MapPin size={14} aria-hidden />
                            {tx.party.seller.meetingLocation.label}
                          </p>
                        ) : null}
                      </article>
                    ) : null}
                    {tx.returnInstructions ? (
                      <article className="ca-tx-detail-card ca-tx-detail-card--accent">
                        <h3>Devolución — directivas del vendedor</h3>
                        <p className="ca-tx-detail-card__hint">
                          Si el comprador rechaza el producto en la entrega personal.
                        </p>
                        <p>{tx.returnInstructions}</p>
                      </article>
                    ) : null}
                  </div>
                ) : instructionsSummary || deliveryLabel ? (
                  <article className="ca-tx-detail-card">
                    <h3>Tus instrucciones para el Agente</h3>
                    {instructionsSummary ? <p>{instructionsSummary}</p> : null}
                    {deliveryLabel ? (
                      <p className="ca-tx-detail-card__meta">
                        <MapPin size={14} aria-hidden />
                        <span>
                          <strong>Entrega:</strong> {deliveryLabel}
                        </span>
                      </p>
                    ) : null}
                  </article>
                ) : null}

                {tx.product ? (
                  <article className="ca-tx-detail-product-card">
                    <div className="ca-tx-detail-product-card__info">
                      <p className="ca-tx-detail-media__kicker">Producto</p>
                      <h3 className="ca-tx-detail-product-card__title">{tx.product.title}</h3>
                      <div className="ca-tx-detail-chips">
                        <span>{CONDITION_LABELS[tx.product.condition]}</span>
                        <span>{CATEGORY_LABELS[tx.product.category]}</span>
                        <span>
                          {formatOperationMoney(
                            tx.product.estimatedValueCents,
                            tx.product.currency,
                          )}
                        </span>
                      </div>
                      {tx.product.description ? (
                        <p className="ca-tx-detail-product-card__desc">{tx.product.description}</p>
                      ) : null}
                    </div>
                    {productImages.length ? (
                      <ul className="ca-tx-detail-product-card__thumbs">
                        {productImages.map((img, index) => (
                          <li key={`${index}-${img.url}`}>
                            <button
                              type="button"
                              onClick={() => setGalleryIndex(index)}
                              aria-label={`Ampliar foto ${index + 1}`}
                            >
                              <img src={img.url} alt={img.alt || `Foto ${index + 1}`} />
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </article>
                ) : null}

                {role !== 'AGENT' && showOwnProduct ? (
                  <article className="ca-tx-detail-card ca-tx-detail-card--muted">
                    <h3>Tu descripción del producto</h3>
                    {own?.productTitle ? (
                      <p className="ca-tx-detail-product__title">{own.productTitle}</p>
                    ) : null}
                    {own?.productDescription ? <p>{own.productDescription}</p> : null}
                  </article>
                ) : null}

                {role !== 'AGENT' && showOtherProduct ? (
                  <article className="ca-tx-detail-card ca-tx-detail-card--muted">
                    <h3>
                      {role === 'BUYER'
                        ? 'Descripción del vendedor'
                        : 'Descripción del comprador'}
                    </h3>
                    {otherPublic?.productTitle ? (
                      <p className="ca-tx-detail-product__title">{otherPublic.productTitle}</p>
                    ) : null}
                    {otherPublic?.productDescription ? (
                      <p>{otherPublic.productDescription}</p>
                    ) : null}
                  </article>
                ) : null}

                {role === 'AGENT' &&
                (tx.party?.buyer?.productTitle ||
                  tx.party?.buyer?.productDescription ||
                  tx.party?.seller?.productTitle ||
                  tx.party?.seller?.productDescription) &&
                !tx.product ? (
                  <div className="ca-tx-detail-cards">
                    {tx.party?.buyer?.productTitle || tx.party?.buyer?.productDescription ? (
                      <article className="ca-tx-detail-card ca-tx-detail-card--muted">
                        <h3>Producto — comprador</h3>
                        {tx.party.buyer.productTitle ? (
                          <p className="ca-tx-detail-product__title">
                            {tx.party.buyer.productTitle}
                          </p>
                        ) : null}
                        {tx.party.buyer.productDescription ? (
                          <p>{tx.party.buyer.productDescription}</p>
                        ) : null}
                      </article>
                    ) : null}
                    {tx.party?.seller?.productTitle || tx.party?.seller?.productDescription ? (
                      <article className="ca-tx-detail-card ca-tx-detail-card--muted">
                        <h3>Producto — vendedor</h3>
                        {tx.party.seller.productTitle ? (
                          <p className="ca-tx-detail-product__title">
                            {tx.party.seller.productTitle}
                          </p>
                        ) : null}
                        {tx.party.seller.productDescription ? (
                          <p>{tx.party.seller.productDescription}</p>
                        ) : null}
                      </article>
                    ) : null}
                  </div>
                ) : null}
              </>
            );
          })()}
        </div>
      </motion.section>

      {(() => {
        const role = tx.viewerRole;
        const buyerItems = tx.party?.buyer?.checklist ?? [];
        const sellerItems = tx.party?.seller?.checklist ?? [];
        const legacyItems =
          !buyerItems.length && !sellerItems.length ? (tx.conditions.checklist ?? []) : [];
        const showAgentBoth = role === 'AGENT';
        const ownItems =
          role === 'BUYER'
            ? buyerItems
            : role === 'SELLER'
              ? sellerItems
              : legacyItems;

        if (showAgentBoth) {
          if (!buyerItems.length && !sellerItems.length && !legacyItems.length) return null;
          return (
            <>
              {buyerItems.length ? (
                <motion.section
                  className="ca-tx-panel ca-tx-detail-media"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.02 }}
                >
                  <div className="ca-tx-detail-media__visual" aria-hidden="true">
                    <img
                      src="/landing/TaskList.png"
                      alt=""
                      width={512}
                      height={512}
                      decoding="async"
                    />
                  </div>
                  <div className="ca-tx-detail-media__body">
                    <AgentChecklistPanel
                      title="Checklist — comprador"
                      items={buyerItems}
                      canToggle={isAssignedAgent}
                      pendingItemId={
                        toggleChecklist.isPending
                          ? (toggleChecklist.variables?.itemId ?? null)
                          : null
                      }
                      onToggle={(itemId, done) => {
                        void toggleChecklist
                          .mutateAsync({ itemId, done, side: 'buyer' })
                          .catch(() => {
                            toast.error('No se pudo actualizar el checklist.');
                          });
                      }}
                    />
                  </div>
                </motion.section>
              ) : null}
              {sellerItems.length ? (
                <motion.section
                  className="ca-tx-panel ca-tx-detail-media"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.03 }}
                >
                  <div className="ca-tx-detail-media__visual" aria-hidden="true">
                    <img
                      src="/landing/TaskList.png"
                      alt=""
                      width={512}
                      height={512}
                      decoding="async"
                    />
                  </div>
                  <div className="ca-tx-detail-media__body">
                    <AgentChecklistPanel
                      title="Checklist — vendedor"
                      items={sellerItems}
                      canToggle={isAssignedAgent}
                      pendingItemId={
                        toggleChecklist.isPending
                          ? (toggleChecklist.variables?.itemId ?? null)
                          : null
                      }
                      onToggle={(itemId, done) => {
                        void toggleChecklist
                          .mutateAsync({ itemId, done, side: 'seller' })
                          .catch(() => {
                            toast.error('No se pudo actualizar el checklist.');
                          });
                      }}
                    />
                  </div>
                </motion.section>
              ) : null}
              {!buyerItems.length && !sellerItems.length && legacyItems.length ? (
                <motion.section
                  className="ca-tx-panel ca-tx-detail-media"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.02 }}
                >
                  <div className="ca-tx-detail-media__visual" aria-hidden="true">
                    <img
                      src="/landing/TaskList.png"
                      alt=""
                      width={512}
                      height={512}
                      decoding="async"
                    />
                  </div>
                  <div className="ca-tx-detail-media__body">
                    <AgentChecklistPanel
                      items={legacyItems}
                      canToggle={isAssignedAgent}
                      pendingItemId={
                        toggleChecklist.isPending
                          ? (toggleChecklist.variables?.itemId ?? null)
                          : null
                      }
                      onToggle={(itemId, done) => {
                        void toggleChecklist.mutateAsync({ itemId, done }).catch(() => {
                          toast.error('No se pudo actualizar el checklist.');
                        });
                      }}
                    />
                  </div>
                </motion.section>
              ) : null}
            </>
          );
        }

        if (!ownItems.length) return null;
        return (
          <motion.section
            className="ca-tx-panel ca-tx-detail-media"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.02 }}
          >
            <div className="ca-tx-detail-media__visual" aria-hidden="true">
              <img
                src="/landing/TaskList.png"
                alt=""
                width={512}
                height={512}
                decoding="async"
              />
            </div>
            <div className="ca-tx-detail-media__body">
              <AgentChecklistPanel
                title="Tu checklist para el Agente"
                items={ownItems}
                canToggle={false}
                onToggle={() => undefined}
              />
            </div>
          </motion.section>
        );
      })()}

      <motion.section
        className="ca-tx-panel ca-tx-detail-media ca-tx-detail-invite"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.04 }}
      >
        <div className="ca-tx-detail-media__visual" aria-hidden="true">
          <img
            src="/landing/Idea.png"
            alt=""
            width={512}
            height={512}
            decoding="async"
          />
        </div>
        <div className="ca-tx-detail-media__body">
          <div className="ca-tx-detail-section">
            <h2>
              <Link2 size={18} aria-hidden />
              Enlace de invitación
            </h2>
            <p className="ca-tx-detail-invite__hint">
              {tx.initiatedBy === 'SELLER'
                ? 'Compartilo con el comprador.'
                : 'Compartilo con el vendedor.'}
              {tx.invite.expiresAt
                ? ` Vence ${formatDateTime(tx.invite.expiresAt)}.`
                : ''}
              {tx.invite.isExpired ? ' Expirado.' : ''}
            </p>
          </div>

          {shareUrl ? (
            <div className="ca-tx-share">
              <p className="ca-tx-share__url">{shareUrl}</p>
              <div className="ca-tx-share__actions">
                <Button className="ca-btn-primary" onClick={() => void copyLink()}>
                  <Copy size={16} className="me-1" />
                  Copiar
                </Button>
                <Button variant="outline-primary" onClick={() => void shareNative()}>
                  <Share2 size={16} className="me-1" />
                  Compartir
                </Button>
                {!hasCounterparty ? (
                  <Button
                    variant="outline-secondary"
                    disabled={refresh.isPending}
                    onClick={() => void onRefresh()}
                  >
                    {refresh.isPending ? (
                      <Spinner size="sm" animation="border" className="me-2" />
                    ) : (
                      <RefreshCw size={16} className="me-1" />
                    )}
                    Regenerar
                  </Button>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="ca-tx-detail-invite__empty">
              <Alert variant="info" className="mb-0">
                El enlace solo se muestra al crearlo o regenerarlo.
              </Alert>
              {!hasCounterparty ? (
                <Button
                  variant="outline-secondary"
                  disabled={refresh.isPending}
                  onClick={() => void onRefresh()}
                >
                  {refresh.isPending ? (
                    <Spinner size="sm" animation="border" className="me-2" />
                  ) : (
                    <RefreshCw size={16} className="me-1" />
                  )}
                  Regenerar enlace
                </Button>
              ) : null}
            </div>
          )}
        </div>
      </motion.section>

      <section className="ca-tx-panel ca-tx-detail-media ca-tx-detail-history">
        <div className="ca-tx-detail-media__visual" aria-hidden="true">
          <img
            src="/landing/WorldTravel.png"
            alt=""
            width={512}
            height={512}
            decoding="async"
          />
        </div>
        <div className="ca-tx-detail-media__body">
          <div className="ca-tx-detail-section">
            <h2>Historial</h2>
          </div>
          <ul className="ca-tx-timeline">
            {tx.statusHistory.map((event, idx) => (
              <li key={`${event.status}-${idx}`} className="ca-tx-timeline__item">
                <div className="ca-tx-timeline__row">
                  <span className="ca-tx-timeline__status">
                    {STATUS_LABELS[event.status]}
                  </span>
                  <time dateTime={event.changedAt}>
                    {formatDateTime(event.changedAt)}
                  </time>
                </div>
                {event.note ? <p className="ca-tx-timeline__note">{event.note}</p> : null}
              </li>
            ))}
          </ul>
          <div className="ca-tx-detail-footer">
            <Link to="/operaciones" className="btn btn-link px-0">
              Volver a operaciones
            </Link>
          </div>
        </div>
      </section>

      {tx.status === 'COMPLETED' ? <ReviewFormPanel transactionCode={tx.code} /> : null}

      <PhotoLightbox
        images={productImages}
        index={galleryIndex ?? 0}
        open={galleryIndex != null}
        onClose={() => setGalleryIndex(null)}
        onIndexChange={setGalleryIndex}
      />
    </div>
  );
}
