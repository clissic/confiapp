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

export interface DisputeEvidenceItemDto {
  id: string;
  kind?: string;
  type: string;
  status: string;
  title: string;
  description?: string;
  storageKey?: string;
  mimeType?: string;
  payload?: Record<string, unknown>;
  /** URL firmada temporal para fotos adjuntas. */
  signedUrl?: string;
  createdAt: string;
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
  /** Expediente generado al abrir la disputa. */
  evidence: DisputeEvidenceItemDto[];
}
