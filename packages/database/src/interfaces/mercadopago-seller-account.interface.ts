import type { Types } from 'mongoose';

import type { MercadoPagoConnectionStatus } from '../types/enums';

/**
 * Cuenta de Mercado Pago vinculada por OAuth a un usuario ConfiApp (vendedor).
 * Tokens se almacenan cifrados (accessTokenEnc / refreshTokenEnc).
 */
export interface IMercadoPagoSellerAccount {
  user: Types.ObjectId;
  mpUserId: string;
  publicNickname?: string;
  email?: string;
  accessTokenEnc: string;
  refreshTokenEnc?: string;
  tokenExpiresAt?: Date;
  scope?: string;
  status: MercadoPagoConnectionStatus;
  connectedAt?: Date;
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

/** State OAuth PKCE de corta duración (one-time). */
export interface IMercadoPagoOAuthState {
  state: string;
  user: Types.ObjectId;
  codeVerifier: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
