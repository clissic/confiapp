export type TransactionStatus =
  | 'CREATED'
  | 'WAITING_PARTICIPANT'
  | 'PENDING_BUYER_CONFIRM'
  | 'ACCEPTED'
  | 'FUNDED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'DISPUTED';

export type TransactionInitiator = 'BUYER' | 'SELLER';

export type ParticipantRole = 'CREATOR' | 'COUNTERPARTY' | 'INTERMEDIARY';
export type ParticipantStatus = 'INVITED' | 'ACCEPTED' | 'DECLINED' | 'REMOVED';

export type ProductCondition = 'NEW' | 'LIKE_NEW' | 'GOOD' | 'FAIR' | 'POOR';
export type ProductCategory =
  | 'ELECTRONICS'
  | 'VEHICLES'
  | 'REAL_ESTATE'
  | 'FASHION'
  | 'HOME'
  | 'SERVICES'
  | 'OTHER';
export type ProductStatus =
  | 'DRAFT'
  | 'LISTED'
  | 'RESERVED'
  | 'IN_TRANSACTION'
  | 'DELIVERED'
  | 'ARCHIVED';

export type ViewerPartyRole = 'BUYER' | 'SELLER' | 'AGENT';

export interface TransactionParticipant {
  userId?: string;
  role: ParticipantRole;
  status: ParticipantStatus;
  invitedAt: string;
  respondedAt?: string;
}

export interface TransactionProduct {
  id: string;
  title: string;
  description?: string;
  condition: ProductCondition;
  category: ProductCategory;
  status: ProductStatus;
  estimatedValueCents?: number;
  currency: string;
  images: Array<{ url: string; alt?: string; sortOrder: number }>;
}

export interface TransactionChecklistItem {
  id: string;
  text: string;
  done: boolean;
  doneAt?: string;
}

export type MeetingLocationMode = 'MAP' | 'CHAT' | 'HOME';

export interface MeetingLocation {
  type: 'Point';
  coordinates: [number, number];
  label: string;
}

export interface DeliveryLocationValue {
  mode: MeetingLocationMode;
  meetingLocation?: MeetingLocation;
}

export interface PartyInstructions {
  conditionsSummary?: string;
  checklist?: TransactionChecklistItem[];
  meetingLocation?: MeetingLocation;
  productTitle?: string;
  productDescription?: string;
}

export interface Transaction {
  id: string;
  code: string;
  title: string;
  description?: string;
  createdBy: string;
  initiatedBy: TransactionInitiator;
  status: TransactionStatus;
  /** @deprecated Preferir party según rol */
  conditions: {
    summary: string;
    checklist?: TransactionChecklistItem[];
  };
  amountCents?: number;
  currency?: string;
  /** @deprecated Preferir party.*.meetingLocation */
  meetingLocation?: MeetingLocation;
  party?: {
    buyer?: PartyInstructions;
    seller?: PartyInstructions;
  };
  /** Directivas del vendedor al Agente (solo visibles para Agente). */
  returnInstructions?: string;
  viewerRole?: ViewerPartyRole | null;
  productId?: string;
  product?: TransactionProduct;
  participants: TransactionParticipant[];
  statusHistory: Array<{
    status: TransactionStatus;
    changedAt: string;
    note?: string;
  }>;
  invite: {
    shareUrl?: string;
    expiresAt?: string;
    isExpired: boolean;
  };
  operationDeadlineAt?: string;
  pendingBuyerChanges?: Array<{ field: string; from: string; to: string }>;
  createdAt: string;
  updatedAt: string;
}

export interface InvitePreview {
  code: string;
  title: string;
  productTitle?: string;
  productDescription?: string;
  amountCents?: number;
  currency?: string;
  status: TransactionStatus;
  initiatedBy: TransactionInitiator;
  inviteExpiresAt?: string;
  isExpired: boolean;
  creatorName?: string;
  hasProduct: boolean;
  hasCounterparty: boolean;
  product?: TransactionProduct;
}

export interface AgentInstructionsPayload {
  conditionsSummary: string;
  checklist?: string[];
  meetingLocationMode?: MeetingLocationMode;
  meetingLocation?: MeetingLocation;
  productTitle?: string;
  productDescription?: string;
}

export interface CreateTransactionPayload extends AgentInstructionsPayload {
  title: string;
  description?: string;
  amount: number;
  currency?: string;
  inviteExpiresInDays?: number;
  productTitle: string;
  productDescription: string;
}

export interface CreateSellerTransactionPayload {
  title: string;
  description?: string;
  conditionsSummary: string;
  checklist?: string[];
  inviteExpiresInDays?: number;
  meetingLocationMode?: MeetingLocationMode;
  meetingLocation?: MeetingLocation;
  returnInstructions: string;
  product: ConfirmSaleProductFields;
}

export interface ConfirmSaleProductFields {
  title: string;
  description: string;
  condition: ProductCondition;
  category?: ProductCategory;
  price: number;
  currency?: string;
  images: Array<{ url: string; alt?: string }>;
}

export interface ConfirmSalePayload extends ConfirmSaleProductFields {
  conditionsSummary: string;
  checklist?: string[];
  meetingLocationMode?: MeetingLocationMode;
  meetingLocation?: MeetingLocation;
  returnInstructions: string;
}

export type AcceptPurchasePayload = AgentInstructionsPayload;

export const STATUS_LABELS: Record<TransactionStatus, string> = {
  CREATED: 'Creada',
  WAITING_PARTICIPANT: 'Esperando participante',
  PENDING_BUYER_CONFIRM: 'Pendiente confirmación del comprador',
  ACCEPTED: 'Aceptada',
  FUNDED: 'Fondeada',
  IN_PROGRESS: 'En curso',
  COMPLETED: 'Completada',
  CANCELLED: 'Cancelada',
  DISPUTED: 'En disputa',
};

export const INITIATOR_LABELS: Record<TransactionInitiator, string> = {
  BUYER: 'Iniciada por comprador',
  SELLER: 'Iniciada por vendedor',
};

export const CONDITION_LABELS: Record<ProductCondition, string> = {
  NEW: 'Nuevo',
  LIKE_NEW: 'Como nuevo',
  GOOD: 'Buen estado',
  FAIR: 'Aceptable',
  POOR: 'Desgastado',
};

export const CATEGORY_LABELS: Record<ProductCategory, string> = {
  ELECTRONICS: 'Electrónica',
  VEHICLES: 'Vehículos',
  REAL_ESTATE: 'Inmuebles',
  FASHION: 'Moda',
  HOME: 'Hogar',
  SERVICES: 'Servicios',
  OTHER: 'Otro',
};
