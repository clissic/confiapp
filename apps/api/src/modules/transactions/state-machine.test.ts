import { describe, expect, it } from 'vitest';
import { TransactionStatus } from '@confiapp/database';

import { ValidationError } from '../../shared/errors/app-error';
import {
  assertTransition,
  canTransition,
  getAllowedTransitions,
} from './state-machine';

describe('transactions/state-machine', () => {
  it('permite el flujo feliz', () => {
    expect(canTransition(TransactionStatus.CREATED, TransactionStatus.WAITING_PARTICIPANT)).toBe(
      true,
    );
    expect(canTransition(TransactionStatus.WAITING_PARTICIPANT, TransactionStatus.ACCEPTED)).toBe(
      true,
    );
    expect(
      canTransition(TransactionStatus.WAITING_PARTICIPANT, TransactionStatus.PENDING_BUYER_CONFIRM),
    ).toBe(true);
    expect(
      canTransition(TransactionStatus.PENDING_BUYER_CONFIRM, TransactionStatus.ACCEPTED),
    ).toBe(true);
    expect(
      canTransition(TransactionStatus.PENDING_BUYER_CONFIRM, TransactionStatus.CANCELLED),
    ).toBe(true);
    expect(canTransition(TransactionStatus.ACCEPTED, TransactionStatus.FUNDED)).toBe(true);
    expect(canTransition(TransactionStatus.FUNDED, TransactionStatus.COMPLETED)).toBe(true);
  });

  it('bloquea saltos inválidos desde PENDING_BUYER_CONFIRM', () => {
    expect(
      canTransition(TransactionStatus.PENDING_BUYER_CONFIRM, TransactionStatus.FUNDED),
    ).toBe(false);
  });

  it('trata same-state como no-op permitido', () => {
    expect(canTransition(TransactionStatus.FUNDED, TransactionStatus.FUNDED)).toBe(true);
  });

  it('bloquea saltos inválidos', () => {
    expect(canTransition(TransactionStatus.CREATED, TransactionStatus.COMPLETED)).toBe(false);
    expect(canTransition(TransactionStatus.COMPLETED, TransactionStatus.FUNDED)).toBe(false);
  });

  it('assertTransition lanza ValidationError', () => {
    expect(() =>
      assertTransition(TransactionStatus.CANCELLED, TransactionStatus.ACCEPTED),
    ).toThrow(ValidationError);
  });

  it('lista transiciones de todos los estados', () => {
    for (const status of Object.values(TransactionStatus)) {
      expect(Array.isArray(getAllowedTransitions(status))).toBe(true);
      expect(canTransition(status, status)).toBe(true);
    }
  });
});
