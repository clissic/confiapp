import type {
  FeePayer,
  ParticipantRole,
  ParticipantStatus,
  ProductCategory,
  ProductCondition,
  ProductStatus,
  TransactionInitiator,
  TransactionStatus,
} from '@confiapp/database';

export type MeetingLocationMode = 'MAP' | 'CHAT' | 'HOME';

export type ViewerPartyRole = 'BUYER' | 'SELLER' | 'AGENT' | null;

export interface MeetingLocationDto {
  type: 'Point';
  coordinates: [number, number];
  label: string;
}

export interface PartyInstructionsInput {
  conditionsSummary: string;
  checklist?: string[];
  meetingLocationMode?: MeetingLocationMode;
  meetingLocation?: MeetingLocationDto;
  productTitle?: string;
  productDescription?: string;
}

export interface CreateTransactionDto {
  title: string;
  description?: string;
  conditionsSummary: string;
  checklist?: string[];
  amount: number;
  currency?: string;
  feePayer: FeePayer;
  inviteExpiresInDays?: number;
  meetingLocationMode?: MeetingLocationMode;
  meetingLocation?: MeetingLocationDto;
  productTitle?: string;
  productDescription?: string;
  /** Tip ConfiAnza (unidades mayores); lo paga el creador. */
  confiAnzaAmount?: number;
  confiAnzaCurrency?: string;
}

export interface CreateSellerTransactionDto {
  title: string;
  description?: string;
  conditionsSummary: string;
  checklist?: string[];
  feePayer: FeePayer;
  inviteExpiresInDays?: number;
  meetingLocationMode?: MeetingLocationMode;
  meetingLocation?: MeetingLocationDto;
  returnInstructions: string;
  confiAnzaAmount?: number;
  confiAnzaCurrency?: string;
  product: {
    title: string;
    description: string;
    condition: ProductCondition;
    category?: ProductCategory;
    price: number;
    currency?: string;
    images: Array<{ url: string; alt?: string }>;
  };
}

export interface ConfirmSaleProductDto {
  title: string;
  description: string;
  condition: ProductCondition;
  category?: ProductCategory;
  price: number;
  currency?: string;
  feePayer: FeePayer;
  images: Array<{ url: string; alt?: string }>;
  conditionsSummary: string;
  checklist?: string[];
  meetingLocationMode?: MeetingLocationMode;
  meetingLocation?: MeetingLocationDto;
  returnInstructions: string;
}

export interface AcceptPurchaseDto {
  conditionsSummary: string;
  feePayer?: FeePayer;
  checklist?: string[];
  meetingLocationMode?: MeetingLocationMode;
  meetingLocation?: MeetingLocationDto;
  productTitle?: string;
  productDescription?: string;
}

export interface TransactionProductDto {
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

export interface TransactionParticipantDto {
  userId?: string;
  role: ParticipantRole;
  status: ParticipantStatus;
  invitedAt: string;
  respondedAt?: string;
}

export interface TransactionChecklistItemDto {
  id: string;
  text: string;
  done: boolean;
  doneAt?: string;
}

/** Instrucciones visibles según rol del viewer. */
export interface PartyInstructionsDto {
  conditionsSummary?: string;
  checklist?: TransactionChecklistItemDto[];
  meetingLocation?: MeetingLocationDto;
  /** Siempre visible a buyer/seller/agent cuando existe. */
  productTitle?: string;
  productDescription?: string;
}

export interface TransactionDto {
  id: string;
  code: string;
  title: string;
  description?: string;
  createdBy: string;
  initiatedBy: TransactionInitiator;
  status: TransactionStatus;
  /** @deprecated Usar party.* según rol */
  conditions: {
    summary: string;
    checklist?: TransactionChecklistItemDto[];
  };
  amountCents?: number;
  currency?: string;
  /** Quién asume la comisión de intermediación. */
  feePayer?: FeePayer;
  /** Tip ConfiAnza en centavos; lo paga siempre el creador. */
  confiAnzaCents?: number;
  confiAnzaCurrency?: string;
  /** @deprecated Usar party.*.meetingLocation */
  meetingLocation?: MeetingLocationDto;
  party?: {
    buyer?: PartyInstructionsDto;
    seller?: PartyInstructionsDto;
  };
  /** Directivas del vendedor al Agente (solo visibles para Agente). */
  returnInstructions?: string;
  viewerRole?: ViewerPartyRole;
  productId?: string;
  product?: TransactionProductDto;
  participants: TransactionParticipantDto[];
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
  /** Límite operativo (21 días desde el join). */
  operationDeadlineAt?: string;
  /** Cambios pendientes de reconfirmación del comprador. */
  pendingBuyerChanges?: Array<{ field: string; from: string; to: string }>;
  createdAt: string;
  updatedAt: string;
}

export interface InvitePreviewDto {
  code: string;
  title: string;
  /** Solo descripción pública del producto / pedido (sin condiciones privadas). */
  productTitle?: string;
  productDescription?: string;
  amountCents?: number;
  currency?: string;
  feePayer?: FeePayer;
  status: TransactionStatus;
  initiatedBy: TransactionInitiator;
  inviteExpiresAt?: string;
  isExpired: boolean;
  creatorName?: string;
  hasProduct: boolean;
  hasCounterparty: boolean;
  product?: TransactionProductDto;
}

export interface TransactionsStatusDto {
  module: 'transactions';
  status: 'ready';
}
