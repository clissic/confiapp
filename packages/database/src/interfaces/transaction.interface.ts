import type { Types } from 'mongoose';

import type {
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
  /** Condiciones acordadas en texto libre. */
  summary: string;
  /**
   * Pasos para el Agente.
   * Compat: docs antiguos pueden tener `string[]`; normalizar en capa de servicio.
   */
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
  /** Punto de encuentro / zona del trabajo (mapa de agentes). */
  meetingLocation?: TransactionMeetingLocation;
  participants: TransactionParticipant[];
  conditions: TransactionConditions;
  status: TransactionStatus;
  statusHistory: TransactionStatusEvent[];
  evidenceIds: Types.ObjectId[];
  /** Valor en unidades menores (centavos). */
  amountCents?: number;
  /** ISO 4217 */
  currency?: string;
  /** Hash del token de invitación compartible (nunca en claro). */
  inviteTokenHash?: string;
  inviteExpiresAt?: Date;
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
