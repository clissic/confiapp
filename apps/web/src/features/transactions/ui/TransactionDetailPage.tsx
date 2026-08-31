import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Alert, Spinner } from 'react-bootstrap';

import { getApiErrorMessage } from '@/shared/api/client';
import { useAuth } from '@/features/auth/ui/AuthProvider';
import { withdrawFromJob } from '@/features/agent-ops/api/agent-ops.api';
import { useAppToast } from '@/shared/ui';
import {
  computeIntermediationFees,
  DEFAULT_UYU_PER_USD,
  type FeePayer as SharedFeePayer,
} from '@confiapp/shared';
import { useEscrow } from '@/features/payments/hooks/usePayments';
import {
  useRefreshInvite,
  useTransaction,
  useBuyerConfirmChanges,
  useBuyerRejectChanges,
} from '../hooks/useTransactions';
import { AgentOperationDetail } from './AgentOperationDetail';
import { BuyerOperationDetail } from './BuyerOperationDetail';
import { SellerOperationDetail } from './SellerOperationDetail';
import { PhotoLightbox } from './PhotoLightbox';
import '../styles/transactions.css';

export function TransactionDetailPage() {
  const toast = useAppToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
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
  const { data, isLoading, isError, refetch } = useTransaction(code);
  const { data: escrowData, refetch: refetchEscrow } = useEscrow(code ?? null);
  const refresh = useRefreshInvite();
  const buyerConfirm = useBuyerConfirmChanges(code);
  const buyerReject = useBuyerRejectChanges(code);
  const [shareUrl, setShareUrl] = useState<string | undefined>(state?.shareUrl);
  const [error, setError] = useState<string | null>(null);
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);
  const navToastShownRef = useRef(false);
  const pagoToastShownRef = useRef(false);

  useEffect(() => {
    const pago = searchParams.get('pago') ?? searchParams.get('status');
    if (!pago) return;
    if (!pagoToastShownRef.current) {
      pagoToastShownRef.current = true;
      if (pago === 'ok' || pago === 'success') {
        toast.success('Pago confirmado. El monto quedó en resguardo.');
        void refetch();
      } else if (pago === 'failure') {
        setError('El pago falló o fue cancelado en Mercado Pago.');
      }
    }
    const next = new URLSearchParams(searchParams);
    next.delete('pago');
    next.delete('status');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, toast, refetch]);

  useEffect(() => {
    if (navToastShownRef.current) return;
    const hasNavFeedback =
      state?.agentAccepted ||
      state?.buyerAccepted ||
      state?.sellerConfirmed ||
      state?.justCreated;
    if (!hasNavFeedback) return;

    navToastShownRef.current = true;

    if (state?.agentAccepted) {
      toast.success('Oferta aceptada. Usá el checklist como guía de la entrega.');
    } else if (state?.buyerAccepted) {
      toast.success('Compra aceptada. Estado actualizado a Aceptada — pendiente de pago.');
    } else if (state?.sellerConfirmed) {
      toast.success(
        state.pendingBuyerConfirm
          ? 'Venta enviada. El comprador debe aceptar los cambios.'
          : 'Venta confirmada. Estado actualizado a Aceptada — pendiente de pago.',
      );
    } else if (state?.justCreated) {
      toast.success(
        state.initiatedBySeller
          ? 'Operación creada. Compartí el enlace con el comprador.'
          : 'Operación creada. Compartí el enlace con el vendedor.',
      );
    }

    navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
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

  const feePreview = useMemo(() => {
    if (!tx?.amountCents || tx.amountCents <= 0) return null;
    try {
      return computeIntermediationFees({
        productCents: tx.amountCents,
        currency: tx.currency || 'UYU',
        feePayer: (tx.feePayer ?? 'BUYER') as SharedFeePayer,
        uyuPerUsd: DEFAULT_UYU_PER_USD,
      });
    } catch {
      return null;
    }
  }, [tx?.amountCents, tx?.currency, tx?.feePayer]);

  const buyerTotalCents = useMemo(() => {
    if (!feePreview) return tx?.amountCents;
    const tip =
      tx?.confiAnzaCents &&
      tx.confiAnzaCents > 0 &&
      (tx.initiatedBy ?? 'BUYER') === 'BUYER' &&
      (tx.confiAnzaCurrency || tx.currency || 'UYU').toUpperCase() ===
        (tx.currency || 'UYU').toUpperCase()
        ? tx.confiAnzaCents
        : 0;
    return feePreview.buyerPaysCents + tip;
  }, [
    feePreview,
    tx?.amountCents,
    tx?.confiAnzaCents,
    tx?.confiAnzaCurrency,
    tx?.currency,
    tx?.initiatedBy,
  ]);

  const pendingPaymentConfirmation = useMemo(
    () =>
      escrowData?.data?.payments?.some(
        (payment) =>
          payment.provider === 'MANUAL_PREX' && payment.status === 'REQUIRES_ACTION',
      ) ?? false,
    [escrowData?.data?.payments],
  );

  useEffect(() => {
    if (!pendingPaymentConfirmation) return;
    const id = window.setInterval(() => {
      void refetch();
      void refetchEscrow();
    }, 8000);
    return () => window.clearInterval(id);
  }, [pendingPaymentConfirmation, refetch, refetchEscrow]);

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
        No se encontró la operación. <Link to="/operaciones">Volver al listado</Link>
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
  const hasAcceptedAgent = tx.participants.some(
    (p) => p.role === 'INTERMEDIARY' && p.status === 'ACCEPTED',
  );
  const lookingForAgent =
    !hasAcceptedAgent &&
    tx.participants.some((p) => p.role === 'INTERMEDIARY' && p.status === 'REMOVED') &&
    (tx.status === 'WAITING_PARTICIPANT' ||
      tx.status === 'ACCEPTED' ||
      tx.status === 'FUNDED' ||
      tx.status === 'IN_PROGRESS' ||
      tx.status === 'DISPUTED');
  const showInvitePanel =
    !hasCounterparty &&
    (tx.status === 'CREATED' || tx.status === 'WAITING_PARTICIPANT');

  const onWithdrawAsAgent = async () => {
    if (!tx?.code) return;
    const ok = window.confirm(
      '¿Solicitar salida de esta operación? El dinero en resguardo no se libera; buscaremos otro agente.',
    );
    if (!ok) return;
    setError(null);
    setWithdrawing(true);
    try {
      await withdrawFromJob(tx.code);
      toast.success('Salida registrada. Las partes fueron avisadas.');
      await refetch();
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudo solicitar la salida.'));
    } finally {
      setWithdrawing(false);
    }
  };

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

  const onPayNow = () => {
    if (!tx?.code) return;
    navigate(`/operaciones/${tx.code}/pagar`);
  };

  if (tx.viewerRole === 'AGENT') {
    return (
      <AgentOperationDetail
        tx={tx}
        error={error}
        withdrawing={withdrawing}
        onWithdraw={() => void onWithdrawAsAgent()}
        onGallery={setGalleryIndex}
        galleryIndex={galleryIndex}
        onCloseGallery={() => setGalleryIndex(null)}
      />
    );
  }

  if (tx.viewerRole === 'BUYER') {
    return (
      <BuyerOperationDetail
        tx={tx}
        error={error}
        pendingPaymentConfirmation={pendingPaymentConfirmation}
        buyerTotalCents={buyerTotalCents}
        lookingForAgent={lookingForAgent && !isAssignedAgent}
        showInvitePanel={showInvitePanel}
        shareUrl={shareUrl}
        refreshPending={refresh.isPending}
        buyerConfirmPending={buyerConfirm.isPending}
        buyerRejectPending={buyerReject.isPending}
        onPayNow={onPayNow}
        onRefresh={() => void onRefresh()}
        onCopyLink={() => void copyLink()}
        onShare={() => void shareNative()}
        onBuyerConfirm={() => void onBuyerConfirm()}
        onBuyerReject={() => void onBuyerReject()}
        onGallery={setGalleryIndex}
        galleryIndex={galleryIndex}
        onCloseGallery={() => setGalleryIndex(null)}
      />
    );
  }

  if (tx.viewerRole === 'SELLER') {
    return (
      <SellerOperationDetail
        tx={tx}
        error={error}
        pendingPaymentConfirmation={pendingPaymentConfirmation}
        lookingForAgent={lookingForAgent && !isAssignedAgent}
        showInvitePanel={showInvitePanel}
        shareUrl={shareUrl}
        refreshPending={refresh.isPending}
        onRefresh={() => void onRefresh()}
        onCopyLink={() => void copyLink()}
        onShare={() => void shareNative()}
        onGallery={setGalleryIndex}
        galleryIndex={galleryIndex}
        onCloseGallery={() => setGalleryIndex(null)}
      />
    );
  }

  return (
    <div className="ca-tx ca-tx--detail">
      <Alert variant="warning" className="mb-0">
        No pudimos determinar tu rol en esta operación.
      </Alert>
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
