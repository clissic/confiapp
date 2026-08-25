/**
 * Abstracción de liquidaciones a agentes.
 * MVP: ManualPayoutProvider (admin confirma transferencia externa).
 */

export interface CreatePayoutRequest {
  agentId: string;
  amountCents: number;
  currency: string;
  commissionIds: string[];
  batchId: string;
  notes?: string;
}

export interface PayoutExecutionResult {
  providerRef: string;
  status: 'PENDING' | 'PROCESSING' | 'PAID' | 'FAILED' | 'CANCELLED';
  raw?: unknown;
}

export interface PayoutProvider {
  readonly name: 'MANUAL' | 'AUTOMATED';
  createPayout(input: CreatePayoutRequest): Promise<PayoutExecutionResult>;
  getPayout(providerRef: string): Promise<PayoutExecutionResult>;
  cancelPayout(providerRef: string): Promise<PayoutExecutionResult>;
  /**
   * Ejecuta la transferencia. Manual: no-op hasta confirmación admin.
   */
  executePayout(providerRef: string): Promise<PayoutExecutionResult>;
  getPayoutStatus(providerRef: string): Promise<PayoutExecutionResult>;
}

export class ManualPayoutProvider implements PayoutProvider {
  readonly name = 'MANUAL' as const;

  async createPayout(input: CreatePayoutRequest): Promise<PayoutExecutionResult> {
    return {
      providerRef: `manual:${input.batchId}:${input.agentId}`,
      status: 'PENDING',
      raw: { mode: 'manual', amountCents: input.amountCents },
    };
  }

  async getPayout(providerRef: string): Promise<PayoutExecutionResult> {
    return { providerRef, status: 'PENDING' };
  }

  async cancelPayout(providerRef: string): Promise<PayoutExecutionResult> {
    return { providerRef, status: 'CANCELLED' };
  }

  async executePayout(providerRef: string): Promise<PayoutExecutionResult> {
    // No transfiere: la confirmación la hace el admin vía API.
    return { providerRef, status: 'PROCESSING' };
  }

  async getPayoutStatus(providerRef: string): Promise<PayoutExecutionResult> {
    return { providerRef, status: 'PENDING' };
  }
}

export const payoutProvider: PayoutProvider = new ManualPayoutProvider();
