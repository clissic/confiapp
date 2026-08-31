import type { Types } from 'mongoose';

import type {
  FeePayer,
  ParticipantRole,
  ParticipantStatus,
  TransactionInitiator,
  TransactionStatus,
} from '../types/enums';

export interface TransactionParticipant {
  user: Types.ObjectId;
  role: ParticipantRole;
  status: ParticipantStatus;
  invitedAt: Date;
  respondedAt?: Date;
}

export interface TransactionChecklistItem {
  id: string;
  text: string;
  done: boolean;
  doneAt?: Date;
  doneBy?: Types.ObjectId;
}

export interface TransactionConditions {
  /** @deprecated Preferir party.buyer / party.seller */
  summary: string;
  /** @deprecated Preferir party.*.checklist */
  checklist?: TransactionChecklistItem[] | string[];
}

export interface TransactionStatusEvent {
  status: TransactionStatus;
  changedAt: Date;
  changedBy?: Types.ObjectId;
  note?: string;
}

export interface TransactionMeetingLocation {
  type: 'Point';
  /** GeoJSON: [longitude, latitude] */
  coordinates: [number, number];
  label?: string;
}

/** Instrucciones de una parte hacia el Agente (privadas respecto de la contraparte). */
export interface TransactionPartyInstructions {
  conditionsSummary: string;
  checklist?: TransactionChecklistItem[] | string[];
  meetingLocation?: TransactionMeetingLocation;
  /** Descripción del producto / pedido visible también a la contraparte. */
  productTitle?: string;
  productDescription?: string;
}

export interface TransactionPartySides {
  buyer?: TransactionPartyInstructions;
  seller?: TransactionPartyInstructions;
}

/**
 * Operación de escrow físico (agregado raíz).
 * Monto en centavos enteros para evitar errores de punto flotante.
 */
export interface ITransaction {
  code: string;
  title: string;
  description?: string;
  createdBy: Types.ObjectId;
  /** Quién inició: comprador (invita vendedor) o vendedor (invita comprador). */
  initiatedBy: TransactionInitiator;
  /** Producto opcional sujeto a la operación. */
  product?: Types.ObjectId;
  /**
   * Legacy: un solo chat. Preferir chats BUYER_AGENT / SELLER_AGENT
   * vinculados por `transaction` + `channel`.
   */
  chat?: Types.ObjectId;
  /** @deprecated Preferir party.*.meetingLocation */
  meetingLocation?: TransactionMeetingLocation;
  /** Instrucciones por lado (buyer/seller) hacia el Agente. */
  party?: TransactionPartySides;
  /**
   * Cómo devolver el objeto si el comprador no lo acepta.
   * Solo visible para el Agente.
   */
  returnInstructions?: string;
  /**
   * Resultado de la verificación del Agente en la entrega.
   * Cuando está definido, el checklist queda cerrado.
   * El comprador luego acepta el producto o rechaza y cancela.
   */
  agentVerification?: {
    allPassed: boolean;
    completedAt: Date;
    completedBy: Types.ObjectId;
    /** Nota opcional del Agente para el comprador. */
    note?: string;
    /** Decisión del comprador tras la verificación en el retiro. */
    buyerDecision?: 'ACCEPTED' | 'REJECTED';
    buyerDecidedAt?: Date;
    buyerDecidedBy?: Types.ObjectId;
  };
  /**
   * Confirmaciones de la entrega al comprador (después de que aceptó la verificación).
   * Cuando ambas están hechas, se liberan los fondos.
   */
  deliveryConfirmation?: {
    buyerArrivalConfirmedAt?: Date;
    buyerArrivalConfirmedBy?: Types.ObjectId;
    agentDeliveryConfirmedAt?: Date;
    agentDeliveryConfirmedBy?: Types.ObjectId;
    /** Timestamp de la primera confirmación (comprador o agente). */
    firstConfirmedAt?: Date;
    /** Plazo de liberación automática (firstConfirmedAt + 72h). */
    autoReleaseAt?: Date;
    /** El sistema completó la confirmación de arribo del comprador. */
    buyerArrivalAuto?: boolean;
    /** El sistema completó la confirmación de entrega del agente. */
    agentDeliveryAuto?: boolean;
    /** Recordatorio ~48h enviado a la parte pendiente. */
    reminder48hSentAt?: Date;
  };
  participants: TransactionParticipant[];
  /** @deprecated Preferir party.*.conditionsSummary / checklist */
  conditions: TransactionConditions;
  status: TransactionStatus;
  statusHistory: TransactionStatusEvent[];
  evidenceIds: Types.ObjectId[];
  /** Valor en unidades menores (centavos). */
  amountCents?: number;
  /** ISO 4217 */
  currency?: string;
  /** Quién asume la comisión de intermediación. */
  feePayer?: FeePayer;
  /** Tip ConfiAnza en centavos; lo paga siempre el creador. */
  confiAnzaCents?: number;
  confiAnzaCurrency?: string;
  /** Hash del token de invitación compartible (nunca en claro). */
  inviteTokenHash?: string;
  inviteExpiresAt?: Date;
  /**
   * Límite operativo (21 días desde confirm-sale / accept-purchase)
   * hasta liberación del pago o cancelación.
   */
  operationDeadlineAt?: Date;
  /** Diff de propuesta pendiente de reconfirmación del comprador. */
  pendingBuyerChanges?: Array<{ field: string; from: string; to: string }>;
  startsAt?: Date;
  endsAt?: Date;
  fundedAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  disputedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}
