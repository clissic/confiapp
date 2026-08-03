export type TransactionStatus =
  | 'CREATED'
  | 'WAITING_PARTICIPANT'
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

export interface Transaction {
  id: string;
  code: string;
  title: string;
  description?: string;
  createdBy: string;
  initiatedBy: TransactionInitiator;
  status: TransactionStatus;
  conditions: {
    summary: string;
    checklist?: string[];
  };
  amountCents?: number;
  currency?: string;
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
  createdAt: string;
  updatedAt: string;
}

export interface InvitePreview {
  code: string;
  title: string;
  description?: string;
  amountCents?: number;
  currency?: string;
  conditionsSummary: string;
  status: TransactionStatus;
  initiatedBy: TransactionInitiator;
  inviteExpiresAt?: string;
  isExpired: boolean;
  creatorName?: string;
  hasProduct: boolean;
  hasCounterparty: boolean;
  product?: TransactionProduct;
}

export interface CreateTransactionPayload {
  title: string;
  description?: string;
  conditionsSummary: string;
  checklist?: string[];
  amount: number;
  currency?: string;
  inviteExpiresInDays?: number;
}

export interface CreateSellerTransactionPayload {
  title: string;
  description?: string;
  conditionsSummary: string;
  checklist?: string[];
  inviteExpiresInDays?: number;
  product: ConfirmSalePayload;
}

export interface ConfirmSalePayload {
  title: string;
  description: string;
  condition: ProductCondition;
  category?: ProductCategory;
  price: number;
  currency?: string;
  images: Array<{ url: string; alt?: string }>;
}

export const STATUS_LABELS: Record<TransactionStatus, string> = {
  CREATED: 'Creada',
  WAITING_PARTICIPANT: 'Esperando participante',
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
