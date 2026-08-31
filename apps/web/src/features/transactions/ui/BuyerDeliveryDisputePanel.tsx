import { Button } from 'react-bootstrap';
import { ShieldAlert } from 'lucide-react';

import { formatDateTime } from '@/shared/lib/money';
import { DISPUTE_CATEGORY_LABELS } from '@/features/disputes/api/disputes.api';
import type { Transaction } from '../model/types';
import { useBuyerDisputeReport } from './BuyerDisputeReportModal';

/** Banner de disputa activa + reporte genérico (fuera del flujo de arribo). */
export function BuyerDeliveryDisputePanel({ tx }: { tx: Transaction }) {
  const disputeReport = useBuyerDisputeReport(tx.code);

  const isDisputed = tx.status === 'DISPUTED';
  const isActive = tx.status === 'FUNDED' || tx.status === 'IN_PROGRESS';
  const agentDeliveryDone = Boolean(tx.deliveryConfirmation?.agentDeliveryConfirmedAt);
  const arrivalDone = Boolean(tx.deliveryConfirmation?.buyerArrivalConfirmedAt);
  const accepted = tx.agentVerification?.buyerDecision === 'ACCEPTED';

  const showNonDeliveryCase =
    isActive && accepted && agentDeliveryDone && !arrivalDone && !isDisputed;
  const showGenericReport = isActive && !isDisputed && !showNonDeliveryCase;

  if (isDisputed) {
    const categoryLabel = tx.activeDispute?.category
      ? DISPUTE_CATEGORY_LABELS[tx.activeDispute.category]
      : 'Reporte en revisión';
    return (
      <section className="ca-tx-panel ca-tx-dispute-banner" aria-live="polite">
        <div className="ca-tx-dispute-banner__head">
          <ShieldAlert size={18} strokeWidth={1.75} aria-hidden />
          <h2>Disputa en revisión</h2>
        </div>
        <p className="mb-2">
          Registramos tu reporte{tx.activeDispute?.openedAt ? ` el ${formatDateTime(tx.activeDispute.openedAt)}` : ''}.
          La liberación de fondos quedó pausada hasta que un administrador resuelva el caso.
        </p>
        {tx.activeDispute?.reason ? (
          <p className="ca-tx-dispute-banner__reason mb-1">
            <span className="ca-tx-dispute-banner__label">{categoryLabel}</span>
            {tx.activeDispute.reason}
          </p>
        ) : null}
      </section>
    );
  }

  if (!showGenericReport) return null;

  return (
    <>
      <div className="ca-tx-dispute-generic">
        <Button
          type="button"
          variant="link"
          className="ca-tx-dispute-generic__link p-0"
          disabled={disputeReport.isPending}
          onClick={() => disputeReport.openReport('other')}
        >
          Reportar un problema con esta operación
        </Button>
      </div>
      {disputeReport.reportModal}
    </>
  );
}
