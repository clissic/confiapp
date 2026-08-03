import type {
  ParticipantRole,
  ParticipantStatus,
  ProductCategory,
  ProductCondition,
  ProductStatus,
  TransactionInitiator,
  TransactionStatus,
} from '@confiapp/database';

export interface CreateTransactionDto {
  title: string;
  description?: string;
  conditionsSummary: string;
  checklist?: string[];
  amount: number;
  currency?: string;
  /** Días de validez del enlace de invitación (1–30). */
  inviteExpiresInDays?: number;
}

export interface CreateSellerTransactionDto {
  title: string;
  description?: string;
  conditionsSummary: string;
  checklist?: string[];
  inviteExpiresInDays?: number;
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
  images: Array<{ url: string; alt?: string }>;
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

export interface TransactionDto {
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
  createdAt: string;
  updatedAt: string;
}

export interface InvitePreviewDto {
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
  product?: TransactionProductDto;
}

export interface TransactionsStatusDto {
  module: 'transactions';
  status: 'ready';
}
