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

/** Aceptada por las partes, aún sin Agente — cancelable por el comprador. */
export const ACCEPTED_WAITING_AGENT = {
  id: 'e2e-tx-acc-wait-agent',
  code: 'E2E-ACC01',
  title: 'Auriculares E2E esperando agente',
  description: 'Seed: cancelación pre-agente',
  createdBy: 'e2e-user-1',
  initiatedBy: 'BUYER',
  status: 'ACCEPTED',
  conditions: { summary: 'Verificar sellado', checklist: [] },
  amountCents: 12_000_00,
  currency: 'UYU',
  feePayer: 'BUYER',
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
    {
      userId: 'e2e-seller-1',
      role: 'COUNTERPARTY',
      status: 'ACCEPTED',
      invitedAt: now,
      respondedAt: now,
    },
  ],
  statusHistory: [
    { status: 'CREATED', changedAt: now },
    { status: 'WAITING_PARTICIPANT', changedAt: now },
    { status: 'ACCEPTED', changedAt: now },
  ],
  invite: { isExpired: false },
  createdAt: now,
  updatedAt: now,
} as const;

/** Agente ya aceptó — muestra sección “Agente de la operación”. */
export const ACCEPTED_WITH_AGENT = {
  id: 'e2e-tx-acc-with-agent',
  code: 'E2E-AGT01',
  title: 'Monitor E2E con agente',
  description: 'Seed: datos del agente visibles',
  createdBy: 'e2e-user-1',
  initiatedBy: 'BUYER',
  status: 'ACCEPTED',
  conditions: { summary: 'Retiro en domicilio', checklist: [] },
  amountCents: 25_000_00,
  currency: 'UYU',
  feePayer: 'BUYER',
  fundingMode: 'AGENT_FEE_ONLY',
  viewerRole: 'BUYER',
  agent: {
    userId: 'e2e-agent-1',
    firstName: 'Lucía',
    lastName: 'Pereira',
    fullName: 'Lucía Pereira',
    phone: '+598 99 123 456',
    avatarUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect fill="%2355c5b5" width="64" height="64"/></svg>',
    ratingAverage: 4.8,
    ratingCount: 12,
    acceptedAt: now,
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
      role: 'INTERMEDIARY',
      status: 'ACCEPTED',
      invitedAt: now,
      respondedAt: now,
    },
  ],
  statusHistory: [
    { status: 'CREATED', changedAt: now },
    { status: 'WAITING_PARTICIPANT', changedAt: now },
    { status: 'ACCEPTED', changedAt: now },
    {
      status: 'ACCEPTED',
      changedAt: now,
      note: 'Agente aceptó la operación',
    },
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
