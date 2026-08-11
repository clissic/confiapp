import {
  AuditAction,
  AuditOutcome,
  type AuditAction as AuditActionType,
} from '@confiapp/database';
import { Types } from 'mongoose';
import type { Request } from 'express';

import { AuditLogModel, UserModel } from '../../database/models';
import { logger } from '../../utils/logger';

export interface AuditRequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditRecordInput {
  actor?: string | null;
  actorRole?: string;
  action: AuditActionType;
  entityType: string;
  entityId: string;
  outcome?: AuditOutcome;
  correlationId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/** Extrae IP / UA de un Request Express. */
export function auditMetaFromRequest(req: Request): AuditRequestMeta {
  return {
    ipAddress: req.ip || (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim(),
    userAgent: req.get('user-agent') ?? undefined,
  };
}

/**
 * Servicio de auditoría append-only.
 * Nunca debe tumbar el flujo de negocio: errores se loguean y se tragan.
 */
export class AuditService {
  async record(input: AuditRecordInput): Promise<void> {
    const outcome = input.outcome ?? AuditOutcome.SUCCESS;
    const safeMeta = sanitizeMetadata(input.metadata);

    logger.info('audit.event', {
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      actor: input.actor ?? null,
      actorRole: input.actorRole,
      outcome,
      correlationId: input.correlationId,
      metadata: safeMeta,
    });

    try {
      if (!Types.ObjectId.isValid(input.entityId)) {
        logger.warn('audit skipped: invalid entityId', {
          action: input.action,
          entityType: input.entityType,
          entityId: input.entityId,
        });
        return;
      }

      await AuditLogModel.create({
        actor:
          input.actor && Types.ObjectId.isValid(input.actor)
            ? new Types.ObjectId(input.actor)
            : undefined,
        actorRole: input.actorRole,
        action: input.action,
        entityType: input.entityType,
        entityId: new Types.ObjectId(input.entityId),
        outcome,
        correlationId: input.correlationId?.slice(0, 128),
        metadata: safeMeta,
        ipAddress: input.ipAddress?.slice(0, 64),
        userAgent: input.userAgent?.slice(0, 512),
      });
    } catch (error) {
      logger.error('audit record failed', {
        error,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
      });
    }
  }

  /** Fire-and-forget wrapper. */
  track(input: AuditRecordInput): void {
    void this.record(input);
  }

  async list(opts: {
    actorId?: string;
    entityType?: string;
    entityId?: string;
    action?: string;
    limit?: number;
    page?: number;
    before?: string;
  }) {
    const limit = Math.min(opts.limit ?? 20, 200);
    const page = Math.max(opts.page ?? 1, 1);
    const filter: Record<string, unknown> = {};
    if (opts.actorId && Types.ObjectId.isValid(opts.actorId)) {
      filter.actor = opts.actorId;
    }
    if (opts.entityType) filter.entityType = opts.entityType;
    if (opts.entityId && Types.ObjectId.isValid(opts.entityId)) {
      filter.entityId = opts.entityId;
    }
    if (opts.action) filter.action = opts.action;
    if (opts.before && Types.ObjectId.isValid(opts.before)) {
      const beforeDoc = await AuditLogModel.findById(opts.before).select('createdAt').lean();
      if (beforeDoc) {
        filter.createdAt = { $lt: beforeDoc.createdAt };
      }
    }

    const [total, rows] = await Promise.all([
      AuditLogModel.countDocuments(filter).exec(),
      AuditLogModel.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec(),
    ]);

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    const userIds = new Set<string>();
    for (const row of rows) {
      if (row.actor) userIds.add(String(row.actor));
      if (row.entityType === 'User' && row.entityId) {
        userIds.add(String(row.entityId));
      }
    }

    const emailByUserId = new Map<string, string>();
    if (userIds.size > 0) {
      const users = await UserModel.find({ _id: { $in: [...userIds] } })
        .select('email')
        .lean()
        .exec();
      for (const user of users) {
        if (user.email) {
          emailByUserId.set(String(user._id), user.email);
        }
      }
    }

    return {
      items: rows.map((row) => {
        const actorId = row.actor ? String(row.actor) : undefined;
        const entityId = String(row.entityId);
        const userId =
          actorId ?? (row.entityType === 'User' ? entityId : undefined);
        const userEmail = userId ? emailByUserId.get(userId) : undefined;

        return {
          id: String(row._id),
          actorId,
          actorRole: row.actorRole,
          action: row.action,
          entityType: row.entityType,
          entityId,
          userId,
          userEmail,
          outcome: row.outcome,
          correlationId: row.correlationId,
          metadata: row.metadata,
          ipAddress: row.ipAddress,
          userAgent: row.userAgent,
          createdAt: row.createdAt.toISOString(),
        };
      }),
      total,
      page,
      limit,
      totalPages,
    };
  }
}

const SENSITIVE_KEYS = new Set([
  'password',
  'currentpassword',
  'newpassword',
  'token',
  'refreshtoken',
  'accesstoken',
  'secret',
  'authorization',
  'inviteToken',
  'invitetoken',
]);

function sanitizeMetadata(
  metadata?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!metadata) return undefined;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) continue;
    out[key] = value;
  }
  return out;
}

export const auditService = new AuditService();

export { AuditAction, AuditOutcome };
