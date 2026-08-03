import { Types } from 'mongoose';
import {
  ParticipantRole,
  ParticipantStatus,
  TransactionInitiator,
  TransactionStatus,
} from '@confiapp/database';

export function objectId() {
  return new Types.ObjectId();
}

export function userFixture(overrides: Record<string, unknown> = {}) {
  return {
    email: `fixture_${objectId().toHexString()}@test.local`,
    fullName: 'Fixture User',
    password: 'TestPass1!',
    ...overrides,
  };
}

export function transactionFixture(overrides: Record<string, unknown> = {}) {
  const createdBy = objectId();
  return {
    code: `TX${Date.now().toString(36).toUpperCase()}`,
    title: 'Operación fixture',
    description: 'Descripción de prueba',
    createdBy,
    initiatedBy: TransactionInitiator.BUYER,
    status: TransactionStatus.WAITING_PARTICIPANT,
    conditions: { summary: 'Condiciones de prueba suficientes' },
    amountCents: 5_000_000,
    currency: 'UYU',
    participants: [
      {
        user: createdBy,
        role: ParticipantRole.CREATOR,
        status: ParticipantStatus.ACCEPTED,
        invitedAt: new Date(),
        respondedAt: new Date(),
      },
    ],
    statusHistory: [
      {
        status: TransactionStatus.WAITING_PARTICIPANT,
        changedAt: new Date(),
        changedBy: createdBy,
        note: 'fixture',
      },
    ],
    ...overrides,
  };
}

export function reviewFixture(overrides: Record<string, unknown> = {}) {
  return {
    rating: 5,
    comment: 'Excelente operación',
    weight: 1,
    ...overrides,
  };
}

export function paymentHoldFixture(overrides: Record<string, unknown> = {}) {
  return {
    amountCents: 5_000_000,
    currency: 'UYU',
    ...overrides,
  };
}
