import type { DisputeCategory, DisputeStatus, TransactionStatus } from '@confiapp/database';

export interface DisputesStatusDto {
  module: 'disputes';
  status: 'ready';
}

export interface DisputeOpenResultDto {
  id: string;
  transactionCode: string;
  status: DisputeStatus;
}

export interface DisputeResolveResultDto {
  id: string;
  status: DisputeStatus;
  transactionStatus: TransactionStatus;
}

export interface ActiveDisputeDto {
  id: string;
  status: DisputeStatus;
  reason: string;
  category?: DisputeCategory;
  openedAt: string;
}

export interface DisputeListItemDto {
  id: string;
  transactionCode: string;
  transactionStatus: TransactionStatus;
  status: DisputeStatus;
  category?: DisputeCategory;
  reason: string;
  openedByName?: string;
  openedByEmail?: string;
  openedAt: string;
}

export interface DisputeListResponseDto {
  items: DisputeListItemDto[];
  total: number;
  page: number;
  totalPages: number;
}

export interface DisputeDetailDto {
  id: string;
  status: DisputeStatus;
  category?: DisputeCategory;
  reason: string;
  resolutionNote?: string;
  openedAt: string;
  resolvedAt?: string;
  transaction: {
    id: string;
    code: string;
    status: TransactionStatus;
    title: string;
  };
  openedBy: {
    id: string;
    displayName?: string;
    email?: string;
  };
  resolvedBy?: {
    id: string;
    displayName?: string;
  };
}
