import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Alert, Badge, Button, Spinner } from 'react-bootstrap';
import { motion } from 'framer-motion';
import { Copy, Handshake, Link2, RefreshCw, Share2 } from 'lucide-react';

import { formatMoney } from '../api/transactions.api';
import { formatDateTime } from '@/shared/lib/money';
import { usePreferencesSnapshot } from '@/shared/preferences';
import { useAuth } from '@/features/auth/ui/AuthProvider';
import { useAppToast } from '@/shared/ui';
import { useRefreshInvite, useToggleChecklistItem, useTransaction } from '../hooks/useTransactions';
import {
  CONDITION_LABELS,
  INITIATOR_LABELS,
  STATUS_LABELS,
  type TransactionStatus,
} from '../model/types';
import { ReviewFormPanel } from '@/features/reputation';
import { AgentChecklistPanel } from './AgentChecklistPanel';
import '../styles/transactions.css';

const STATE_PIPELINE: TransactionStatus[] = [
  'CREATED',
  'WAITING_PARTICIPANT',
  'ACCEPTED',
  'FUNDED',
  'IN_PROGRESS',
  'COMPLETED',
];

function pipelineIndex(status: TransactionStatus): number {
  if (status === 'CANCELLED' || status === 'DISPUTED') return -1;
  return STATE_PIPELINE.indexOf(status);
}

export function TransactionDetailPage() {
  usePreferencesSnapshot();
  const toast = useAppToast();
  const { user } = useAuth();
  const { code } = useParams<{ code: string }>();
  const location = useLocation();
  const state = location.state as {
    shareUrl?: string;
    justCreated?: boolean;
    sellerConfirmed?: boolean;
    buyerAccepted?: boolean;
    initiatedBySeller?: boolean;
    agentAccepted?: boolean;
  } | null;
  const { data, isLoading, isError } = useTransaction(code);
  const refresh = useRefreshInvite();
  const toggleChecklist = useToggleChecklistItem(code);
  const [shareUrl, setShareUrl] = useState<string | undefined>(state?.shareUrl);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (state?.agentAccepted) {
      toast.success('Oferta aceptada. Usá el checklist como guía de la entrega.');
    } else if (state?.buyerAccepted) {
      toast.success('Compra aceptada. Estado actualizado a Aceptada — pendiente de fondeo.');
    } else if (state?.sellerConfirmed) {
      toast.success('Venta confirmada. Estado actualizado a Aceptada — pendiente de fondeo.');
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

  if (isLoading) {
    return (
      <div className="ca-tx ca-tx--loading">
        <Spinner animation="border" />
        <span>Cargando operación…</span>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <Alert variant="danger">
        No se encontró la operación.{' '}
        <Link to="/operaciones">Volver al listado</Link>
      </Alert>
    );
  }

  const tx = data.data;
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
  const checklist = tx.conditions.checklist ?? [];

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

  return (
    <div className="ca-tx">
      <header className="ca-tx__header">
        <div className="ca-tx__brand">
          <Handshake size={22} strokeWidth={1.75} />
          <div>
            <p className="ca-tx__kicker">{tx.code}</p>
            <h2 className="ca-tx__title">{tx.title}</h2>
            <p className="ca-tx__lead">{tx.description || 'Sin descripción adicional.'}</p>
          </div>
        </div>
        <div className="ca-tx__meta">
          <Badge bg="primary">{STATUS_LABELS[tx.status]}</Badge>
          <Badge bg="secondary">{INITIATOR_LABELS[tx.initiatedBy ?? 'BUYER']}</Badge>
        </div>
      </header>

      {error ? <Alert variant="danger">{error}</Alert> : null}

      <section className="ca-tx-panel">
        <h3 className="ca-section-title">Máquina de estados</h3>
        <p className="ca-section-lead">
          Estado actual: <strong>{STATUS_LABELS[tx.status]}</strong>
        </p>
        {tx.status === 'CANCELLED' || tx.status === 'DISPUTED' ? (
          <Badge bg="danger">{STATUS_LABELS[tx.status]}</Badge>
        ) : (
          <ol className="ca-tx-pipeline">
            {STATE_PIPELINE.map((stepStatus, index) => {
              const current = pipelineIndex(tx.status);
              const done = current > index;
              const active = current === index;
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
                  <span>{index + 1}</span>
                  {STATUS_LABELS[stepStatus]}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <motion.section
        className="ca-tx-panel"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h3 className="ca-section-title">Resumen</h3>
        <p className="ca-section-lead">
          Monto: <strong>{formatMoney(tx.amountCents, tx.currency)}</strong>
        </p>
        <p>{tx.conditions.summary}</p>
      </motion.section>

      {checklist.length ? (
        <motion.section
          className="ca-tx-panel"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.02 }}
        >
          <AgentChecklistPanel
            items={checklist}
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
        </motion.section>
      ) : null}

      {tx.product ? (
        <motion.section
          className="ca-tx-panel"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.03 }}
        >
          <h3 className="ca-section-title">Producto del vendedor</h3>
          <p className="ca-section-lead">
            {CONDITION_LABELS[tx.product.condition]} ·{' '}
            {formatMoney(tx.product.estimatedValueCents, tx.product.currency)} · estado{' '}
            {tx.product.status}
          </p>
          <p className="fw-semibold mb-1">{tx.product.title}</p>
          {tx.product.description ? <p>{tx.product.description}</p> : null}
          {tx.product.images.length ? (
            <ul className="ca-tx-photos__grid">
              {tx.product.images.map((img) => (
                <li key={`${img.sortOrder}-${img.url}`}>
                  <img src={img.url} alt={img.alt || tx.product!.title} />
                </li>
              ))}
            </ul>
          ) : null}
        </motion.section>
      ) : null}

      <motion.section
        className="ca-tx-panel"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        <h3 className="ca-section-title">
          <Link2 size={18} className="me-1" />
          Enlace de invitación
        </h3>
        <p className="ca-section-lead">
          {tx.initiatedBy === 'SELLER'
            ? 'Compartí este enlace con el comprador.'
            : 'Compartí este enlace con el vendedor.'}{' '}
          {tx.invite.expiresAt
            ? `Vence: ${formatDateTime(tx.invite.expiresAt)}`
            : 'Sin vencimiento registrado'}
          {tx.invite.isExpired ? ' · Expirado' : ''}
        </p>

        {shareUrl ? (
          <div className="ca-tx-share">
            <p className="ca-tx-share__url">{shareUrl}</p>
            <div className="ca-tx-share__actions">
              <Button className="ca-btn-primary" onClick={() => void copyLink()}>
                <Copy size={16} className="me-1" />
                Copiar enlace
              </Button>
              <Button variant="outline-primary" onClick={() => void shareNative()}>
                <Share2 size={16} className="me-1" />
                Compartir
              </Button>
            </div>
          </div>
        ) : (
          <Alert variant="info" className="mb-0">
            Por seguridad el enlace solo se muestra al crearlo o regenerarlo. Generá uno
            nuevo para compartir.
          </Alert>
        )}

        <div className="ca-form-actions">
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
          <Link to="/operaciones" className="btn btn-link">
            Ver todas
          </Link>
        </div>
      </motion.section>

      <section className="ca-tx-panel">
        <h3 className="ca-section-title">Estados</h3>
        <ul className="ca-tx-timeline">
          {tx.statusHistory.map((event, idx) => (
            <li key={`${event.status}-${idx}`} className="ca-tx-timeline__item">
              <span className="ca-tx-timeline__status">
                {STATUS_LABELS[event.status]}
              </span>
              <p className="ca-tx-timeline__note">
                {event.note || 'Cambio de estado'} ·{' '}
                {formatDateTime(event.changedAt)}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {tx.status === 'COMPLETED' ? <ReviewFormPanel transactionCode={tx.code} /> : null}
    </div>
  );
}
