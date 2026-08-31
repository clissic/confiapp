import type { ITransaction } from '@confiapp/database';
import {
  ParticipantRole,
  ParticipantStatus,
  TransactionInitiator,
} from '@confiapp/database';
import type { HydratedDocument } from 'mongoose';

/** Plazo de liberación automática tras la primera confirmación de entrega. */
export const DELIVERY_AUTO_RELEASE_MS = 72 * 60 * 60 * 1000;

/** Ventana antes del auto-release para enviar recordatorio (~48h tras primera confirmación). */
export const DELIVERY_REMINDER_WINDOW_MS = 24 * 60 * 60 * 1000;

const DELIVERY_DEADLINE_LOCALE = 'es-UY';
const DELIVERY_DEADLINE_TIMEZONE = 'America/Montevideo';

export function formatDeliveryDeadlineLocal(date: Date): string {
  return date.toLocaleString(DELIVERY_DEADLINE_LOCALE, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: DELIVERY_DEADLINE_TIMEZONE,
  });
}

/** Texto legal/operativo del plazo de 72h para confirmar arribo o reportar no recepción. */
export function deliveryAutoReleaseNotice(autoReleaseAt?: Date): string {
  const deadline = autoReleaseAt
    ? ` Plazo límite: ${formatDeliveryDeadlineLocal(autoReleaseAt)}.`
    : '';
  return (
    'Si no confirmás el arribo ni reportás que no recibiste el producto dentro de las 72 horas, ' +
    'el sistema registrará la recepción automáticamente y se liberarán los fondos.' +
    deadline
  );
}

type DeliveryConfirmation = NonNullable<ITransaction['deliveryConfirmation']>;

export function stampFirstDeliveryConfirmationDeadline(
  existing: DeliveryConfirmation | undefined,
  now: Date,
): DeliveryConfirmation {
  const base = existing ?? {};
  if (base.firstConfirmedAt) return base;
  const firstConfirmedAt = now;
  return {
    ...base,
    firstConfirmedAt,
    autoReleaseAt: new Date(now.getTime() + DELIVERY_AUTO_RELEASE_MS),
  };
}

export function mapDeliveryConfirmationToDto(
  dc: DeliveryConfirmation | undefined,
):
  | {
      buyerArrivalConfirmedAt?: string;
      agentDeliveryConfirmedAt?: string;
      firstConfirmedAt?: string;
      autoReleaseAt?: string;
      buyerArrivalAuto?: boolean;
      agentDeliveryAuto?: boolean;
    }
  | undefined {
  if (
    !dc?.buyerArrivalConfirmedAt &&
    !dc?.agentDeliveryConfirmedAt &&
    !dc?.firstConfirmedAt
  ) {
    return undefined;
  }
  return {
    ...(dc.buyerArrivalConfirmedAt
      ? { buyerArrivalConfirmedAt: dc.buyerArrivalConfirmedAt.toISOString() }
      : {}),
    ...(dc.agentDeliveryConfirmedAt
      ? { agentDeliveryConfirmedAt: dc.agentDeliveryConfirmedAt.toISOString() }
      : {}),
    ...(dc.firstConfirmedAt ? { firstConfirmedAt: dc.firstConfirmedAt.toISOString() } : {}),
    ...(dc.autoReleaseAt ? { autoReleaseAt: dc.autoReleaseAt.toISOString() } : {}),
    ...(dc.buyerArrivalAuto ? { buyerArrivalAuto: true } : {}),
    ...(dc.agentDeliveryAuto ? { agentDeliveryAuto: true } : {}),
  };
}

export function resolveTransactionPartyIds(tx: HydratedDocument<ITransaction>): {
  buyerId?: string;
  sellerId?: string;
  agentId?: string;
} {
  const initiatedBy = tx.initiatedBy ?? TransactionInitiator.BUYER;
  const buyerIsCreator = initiatedBy === TransactionInitiator.BUYER;
  const counter = tx.participants.find((p) => p.role === ParticipantRole.COUNTERPARTY);
  const agent = tx.participants.find(
    (p) =>
      p.role === ParticipantRole.INTERMEDIARY && p.status === ParticipantStatus.ACCEPTED,
  );
  const creatorId = String(tx.createdBy);
  const counterId = counter?.user ? String(counter.user) : undefined;
  return {
    buyerId: buyerIsCreator ? creatorId : counterId,
    sellerId: buyerIsCreator ? counterId : creatorId,
    agentId: agent?.user ? String(agent.user) : undefined,
  };
}
