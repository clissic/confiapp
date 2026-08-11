import { NotificationChannel, NotificationType } from '@confiapp/database';
import { describe, expect, it } from 'vitest';

import { isCategoryEnabled, resolveDelivery } from './resolve-delivery';

describe('notifications/resolve-delivery', () => {
  it('silencia MESSAGE si messageAlerts está OFF', () => {
    const result = resolveDelivery(
      { messageAlerts: false, inApp: true, push: true },
      NotificationType.MESSAGE,
    );
    expect(result).toEqual({ skip: true, reason: 'category_off' });
  });

  it('no exige inApp===false junto a messageAlerts (regla única de categoría)', () => {
    const result = resolveDelivery(
      { messageAlerts: false, inApp: true },
      NotificationType.MESSAGE,
      [NotificationChannel.IN_APP],
    );
    expect(result.skip).toBe(true);
  });

  it('entrega MESSAGE con inApp+push cuando categoría ON', () => {
    const result = resolveDelivery(
      { messageAlerts: true, inApp: true, push: true },
      NotificationType.MESSAGE,
    );
    expect(result.skip).toBe(false);
    if (!result.skip) {
      expect(result.channels).toEqual([
        NotificationChannel.IN_APP,
        NotificationChannel.PUSH,
      ]);
      expect(result.primary).toBe(NotificationChannel.IN_APP);
    }
  });

  it('omite canal si prefs de canal están OFF', () => {
    const result = resolveDelivery(
      { messageAlerts: true, inApp: true, push: false },
      NotificationType.MESSAGE,
    );
    expect(result.skip).toBe(false);
    if (!result.skip) {
      expect(result.channels).toEqual([NotificationChannel.IN_APP]);
    }
  });

  it('skip si ningún canal queda habilitado', () => {
    const result = resolveDelivery(
      { paymentAlerts: true, inApp: false, push: false, email: false },
      NotificationType.PAYMENT,
      [NotificationChannel.IN_APP, NotificationChannel.PUSH, NotificationChannel.EMAIL],
    );
    expect(result).toEqual({ skip: true, reason: 'no_channels' });
  });

  it('AGENT_ASSIGNMENT y TRANSACTION_UPDATE usan transactionUpdates', () => {
    expect(
      isCategoryEnabled({ transactionUpdates: false }, NotificationType.AGENT_ASSIGNMENT),
    ).toBe(false);
    expect(
      isCategoryEnabled({ transactionUpdates: false }, NotificationType.TRANSACTION_UPDATE),
    ).toBe(false);
    expect(
      isCategoryEnabled({ transactionUpdates: true }, NotificationType.REVIEW),
    ).toBe(true);
  });

  it('PAYMENT / DISPUTE respetan sus switches', () => {
    expect(isCategoryEnabled({ paymentAlerts: false }, NotificationType.PAYMENT)).toBe(
      false,
    );
    expect(isCategoryEnabled({ disputeAlerts: false }, NotificationType.DISPUTE)).toBe(
      false,
    );
  });

  it('SYSTEM no usa marketing y siempre tiene categoría ON; agrega EMAIL', () => {
    expect(isCategoryEnabled({ marketing: false }, NotificationType.SYSTEM)).toBe(true);

    const withEmailOff = resolveDelivery(
      { email: false, inApp: true, push: false },
      NotificationType.SYSTEM,
      [NotificationChannel.IN_APP],
    );
    expect(withEmailOff.skip).toBe(false);
    if (!withEmailOff.skip) {
      expect(withEmailOff.channels).toEqual([NotificationChannel.IN_APP]);
    }

    const securityEmail = resolveDelivery(
      { email: true, inApp: false, push: false },
      NotificationType.SYSTEM,
      [NotificationChannel.IN_APP],
    );
    expect(securityEmail.skip).toBe(false);
    if (!securityEmail.skip) {
      expect(securityEmail.channels).toContain(NotificationChannel.EMAIL);
      expect(securityEmail.primary).toBe(NotificationChannel.EMAIL);
    }
  });

  it('TRANSACTION_UPDATE y PAYMENT agregan EMAIL aunque el caller no lo pida', () => {
    const tx = resolveDelivery(
      { transactionUpdates: true, inApp: true, push: true, email: true },
      NotificationType.TRANSACTION_UPDATE,
      [NotificationChannel.IN_APP, NotificationChannel.PUSH],
    );
    expect(tx.skip).toBe(false);
    if (!tx.skip) {
      expect(tx.channels).toContain(NotificationChannel.EMAIL);
    }

    const pay = resolveDelivery(
      { paymentAlerts: true, inApp: true, push: false, email: true },
      NotificationType.PAYMENT,
      [NotificationChannel.IN_APP],
    );
    expect(pay.skip).toBe(false);
    if (!pay.skip) {
      expect(pay.channels).toEqual([
        NotificationChannel.IN_APP,
        NotificationChannel.EMAIL,
      ]);
    }
  });

  it('MESSAGE no fuerza EMAIL', () => {
    const result = resolveDelivery(
      { messageAlerts: true, inApp: true, push: true, email: true },
      NotificationType.MESSAGE,
      [NotificationChannel.IN_APP, NotificationChannel.PUSH],
    );
    expect(result.skip).toBe(false);
    if (!result.skip) {
      expect(result.channels).not.toContain(NotificationChannel.EMAIL);
    }
  });
});
