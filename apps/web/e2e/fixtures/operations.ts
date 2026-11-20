/** Operaciones demo para E2E (shape alineado a Transaction del web). */

const now = new Date().toISOString();

export const FUNDED_AWAITING_BUYER_DECISION = {
  id: 'e2e-tx-funded-1',
  code: 'E2E-FUND01',
  title: 'Notebook E2E verificación',
  description: 'Operación seed para decisión del comprador',
  createdBy: 'e2e-user-1',
  initiatedBy: 'BUYER',
  status: 'FUNDED',
  conditions: {
    summary: 'Verificar estado y accesorios',
    checklist: [{ id: 'ck1', text: 'Encendido OK', done: true }],
  },
  amountCents: 50_000_00,
  currency: 'UYU',
  feePayer: 'BUYER',
  fundingMode: 'AGENT_FEE_ONLY',
  viewerRole: 'BUYER',
  agentVerification: {
    allPassed: true,
    completedAt: now,
    note: 'Producto en buen estado',
  },
  participants: [
    {
      userId: 'e2e-user-1',
      role: 'CREATOR',
      status: 'ACCEPTED',
      invitedAt: now,
      respondedAt: now,
    },
    {
      userId: 'e2e-seller-1',
      role: 'COUNTERPARTY',
      status: 'ACCEPTED',
      invitedAt: now,
      respondedAt: now,
    },
    {
      userId: 'e2e-agent-1',
      role: 'AGENT',
      status: 'ACCEPTED',
      invitedAt: now,
      respondedAt: now,
    },
  ],
  statusHistory: [
    { status: 'CREATED', changedAt: now },
    { status: 'WAITING_PARTICIPANT', changedAt: now },
    { status: 'ACCEPTED', changedAt: now },
    { status: 'FUNDED', changedAt: now, note: 'Contratación del Agente pagada' },
  ],
  invite: { isExpired: false },
  createdAt: now,
  updatedAt: now,
} as const;

export const CREATED_WAITING = {
  id: 'e2e-tx-wait-1',
  code: 'E2E-WAIT01',
  title: 'Operación E2E en espera',
  createdBy: 'e2e-user-1',
  initiatedBy: 'BUYER',
  status: 'WAITING_PARTICIPANT',
  conditions: { summary: 'Checklist demo', checklist: [] },
  fundingMode: 'AGENT_FEE_ONLY',
  viewerRole: 'BUYER',
  participants: [
    {
      userId: 'e2e-user-1',
      role: 'CREATOR',
      status: 'ACCEPTED',
      invitedAt: now,
      respondedAt: now,
    },
  ],
  statusHistory: [
    { status: 'CREATED', changedAt: now },
    { status: 'WAITING_PARTICIPANT', changedAt: now },
  ],
  invite: {
    shareUrl: 'http://localhost:3001/operaciones/unirse/demo-token',
    expiresAt: new Date(Date.now() + 7 * 86400_000).toISOString(),
    isExpired: false,
  },
  createdAt: now,
  updatedAt: now,
} as const;
