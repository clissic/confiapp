import { describe, expect, it } from 'vitest';
import {
  ACCOUNT_DELETION_CONFIRMATION,
  ACCOUNT_DELETION_GRACE_DAYS,
  addAccountDeletionGraceDays,
  isAccountDeletionWithinGrace,
} from '@confiapp/shared';

import { ACTIVE_PARTY_TX_STATUSES } from './account-deletion';

describe('account deletion grace', () => {
  it('exposes confirmation and 30-day grace', () => {
    expect(ACCOUNT_DELETION_CONFIRMATION).toBe('Eliminar');
    expect(ACCOUNT_DELETION_GRACE_DAYS).toBe(30);
  });

  it('is within grace just after request', () => {
    const requestedAt = new Date('2026-01-01T00:00:00.000Z');
    const now = new Date('2026-01-15T00:00:00.000Z');
    expect(isAccountDeletionWithinGrace(requestedAt, now)).toBe(true);
  });

  it('is outside grace after 30 days', () => {
    const requestedAt = new Date('2026-01-01T00:00:00.000Z');
    const now = addAccountDeletionGraceDays(requestedAt);
    expect(isAccountDeletionWithinGrace(requestedAt, now)).toBe(false);
    expect(isAccountDeletionWithinGrace(requestedAt, new Date(now.getTime() + 1))).toBe(false);
  });

  it('rejects null request', () => {
    expect(isAccountDeletionWithinGrace(null)).toBe(false);
    expect(isAccountDeletionWithinGrace(undefined)).toBe(false);
  });
});

describe('account deletion blockers', () => {
  it('blocks party transactions in non-terminal statuses including disputes', () => {
    expect(ACTIVE_PARTY_TX_STATUSES).toEqual(
      expect.arrayContaining([
        'CREATED',
        'WAITING_PARTICIPANT',
        'PENDING_BUYER_CONFIRM',
        'ACCEPTED',
        'FUNDED',
        'IN_PROGRESS',
        'DISPUTED',
      ]),
    );
    expect(ACTIVE_PARTY_TX_STATUSES).not.toContain('COMPLETED');
    expect(ACTIVE_PARTY_TX_STATUSES).not.toContain('CANCELLED');
  });
});
