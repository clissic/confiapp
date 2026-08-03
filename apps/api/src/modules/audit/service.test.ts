import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request } from 'express';

vi.mock('../../database/models', () => ({
  AuditLogModel: {
    create: vi.fn().mockResolvedValue({}),
    find: vi.fn(),
    findById: vi.fn(),
  },
}));

import { AuditLogModel } from '../../database/models';
import { AuditAction, AuditOutcome, auditMetaFromRequest, auditService } from './service';

describe('audit/service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('extrae meta desde Request', () => {
    const req = {
      ip: '127.0.0.1',
      headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
      get: (h: string) => (h.toLowerCase() === 'user-agent' ? 'vitest' : undefined),
    } as unknown as Request;
    expect(auditMetaFromRequest(req).userAgent).toBe('vitest');
  });

  it('omite entityId inválido', async () => {
    await auditService.record({
      action: AuditAction.LOGIN,
      entityType: 'User',
      entityId: 'not-an-id',
    });
    expect(AuditLogModel.create).not.toHaveBeenCalled();
  });

  it('sanitiza metadata sensible', async () => {
    await auditService.record({
      actor: '507f1f77bcf86cd799439011',
      action: AuditAction.LOGIN,
      entityType: 'User',
      entityId: '507f1f77bcf86cd799439011',
      outcome: AuditOutcome.SUCCESS,
      metadata: {
        password: 'secret',
        token: 'abc',
        reason: 'ok',
      },
    });
    expect(AuditLogModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: { reason: 'ok' },
      }),
    );
  });

  it('track no lanza ante fallo de persistencia', async () => {
    (AuditLogModel.create as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('db'));
    expect(() =>
      auditService.track({
        action: AuditAction.SYSTEM,
        entityType: 'System',
        entityId: '507f1f77bcf86cd799439011',
      }),
    ).not.toThrow();
    await new Promise((r) => setTimeout(r, 20));
  });

  it('lista con filtros y before cursor', async () => {
    const leanExec = vi.fn().mockResolvedValue([
      {
        _id: '507f1f77bcf86cd799439012',
        actor: '507f1f77bcf86cd799439011',
        action: AuditAction.LOGIN,
        entityType: 'User',
        entityId: '507f1f77bcf86cd799439011',
        createdAt: new Date('2026-01-01T00:00:00Z'),
      },
    ]);
    const lean = vi.fn().mockReturnValue({ exec: leanExec });
    const limit = vi.fn().mockReturnValue({ lean });
    const sort = vi.fn().mockReturnValue({ limit });
    (AuditLogModel.find as ReturnType<typeof vi.fn>).mockReturnValue({ sort });
    (AuditLogModel.findById as ReturnType<typeof vi.fn>).mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue({ createdAt: new Date('2026-01-02T00:00:00Z') }),
      }),
    });

    const result = await auditService.list({
      actorId: '507f1f77bcf86cd799439011',
      entityType: 'User',
      entityId: '507f1f77bcf86cd799439011',
      action: AuditAction.LOGIN,
      before: '507f1f77bcf86cd799439099',
      limit: 10,
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.action).toBe(AuditAction.LOGIN);
  });

  it('extrae IP desde x-forwarded-for', () => {
    const req = {
      ip: undefined,
      headers: { 'x-forwarded-for': '9.9.9.9, 8.8.8.8' },
      get: () => undefined,
    } as unknown as Request;
    expect(auditMetaFromRequest(req).ipAddress).toBe('9.9.9.9');
  });
});
