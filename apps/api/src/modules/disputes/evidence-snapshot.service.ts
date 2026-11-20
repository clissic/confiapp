import {
  ChatModel,
  EvidenceKind,
  EvidenceStatus,
  EvidenceType,
  MessageModel,
  ParticipantRole,
  ParticipantStatus,
  PaymentModel,
  PaymentType,
  ProductModel,
  type ITransaction,
} from '@confiapp/database';
import { Types } from 'mongoose';

import {
  EvidenceModel,
  TransactionModel,
  UserModel,
} from '../../database/models';
import {
  createPresignedGet,
  isObjectStorageConfigured,
} from '../../infrastructure/storage/object-storage';
import { logger } from '../../utils/logger';
import { resolveTransactionPartyIds } from '../transactions/delivery-deadline';

const MAX_CHAT_MESSAGES = 800;
const MAX_PHOTO_ATTACHMENTS = 5;

function maskDocument(value?: string | null): string | undefined {
  const raw = value?.trim();
  if (!raw) return undefined;
  if (raw.length <= 4) return '••••';
  return `••••${raw.slice(-4)}`;
}

function checklistSnapshot(checklist: unknown) {
  if (!Array.isArray(checklist)) return [];
  return checklist.map((item) => {
    if (typeof item === 'string') return { text: item, done: false };
    if (item && typeof item === 'object') {
      const row = item as {
        id?: string;
        text?: string;
        done?: boolean;
        doneAt?: Date | string;
      };
      return {
        id: row.id,
        text: row.text,
        done: Boolean(row.done),
        doneAt: row.doneAt ? new Date(row.doneAt).toISOString() : undefined,
      };
    }
    return { text: String(item), done: false };
  });
}

function partyInstructionsSnapshot(side?: {
  conditionsSummary?: string;
  checklist?: unknown;
  productTitle?: string;
  productDescription?: string;
  meetingLocation?: { coordinates?: [number, number]; label?: string };
}) {
  if (!side) return undefined;
  return {
    conditionsSummary: side.conditionsSummary,
    productTitle: side.productTitle,
    productDescription: side.productDescription,
    meetingLabel: side.meetingLocation?.label,
    meetingCoordinates: side.meetingLocation?.coordinates,
    checklist: checklistSnapshot(side.checklist),
  };
}

async function loadUserDossier(userId: string, role: 'BUYER' | 'SELLER' | 'AGENT') {
  const user = await UserModel.findById(userId)
    .select(
      'email fullName displayName phone documentNumber role roles status emailVerifiedAt phoneVerifiedAt avatar rating stats verification.identity.status verification.identity.verifiedAt verification.identity.rejectedAt kyc.status idDigital agent.status agent.activatedAt createdAt',
    )
    .lean()
    .exec();
  if (!user) {
    return { id: userId, role, missing: true as const };
  }

  const idDigital = user.idDigital
    ? {
        linked: Boolean(user.idDigital.sub),
        linkedAt: user.idDigital.linkedAt
          ? new Date(user.idDigital.linkedAt).toISOString()
          : undefined,
        lastVerifiedAt: user.idDigital.lastVerifiedAt
          ? new Date(user.idDigital.lastVerifiedAt).toISOString()
          : undefined,
        lastAcr: user.idDigital.lastAcr,
        lastMethods: user.idDigital.lastMethods,
        onboardingVerifiedAt: user.idDigital.onboardingVerifiedAt
          ? new Date(user.idDigital.onboardingVerifiedAt).toISOString()
          : undefined,
        registrationLevel: user.idDigital.registrationLevel,
        registrationLevelDescription: user.idDigital.registrationLevelDescription,
        documentType: user.idDigital.document?.type,
        documentNumberMasked: maskDocument(user.idDigital.document?.number),
        documentCountry: user.idDigital.document?.country,
        documentMismatch: user.idDigital.documentMismatch,
        validationMethods: (user.idDigital.validationMethods ?? []).map((m) => ({
          name: m.name,
          lastValidationDate: m.lastValidationDate
            ? new Date(m.lastValidationDate).toISOString()
            : undefined,
        })),
      }
    : undefined;

  return {
    id: String(user._id),
    role,
    email: user.email,
    fullName: user.fullName,
    displayName: user.displayName,
    phone: user.phone,
    documentNumberMasked: maskDocument(user.documentNumber),
    platformRole: user.role,
    roles: user.roles,
    status: user.status,
    emailVerifiedAt: user.emailVerifiedAt
      ? new Date(user.emailVerifiedAt).toISOString()
      : undefined,
    phoneVerifiedAt: user.phoneVerifiedAt
      ? new Date(user.phoneVerifiedAt).toISOString()
      : undefined,
    avatar: user.avatar,
    rating: user.rating,
    stats: user.stats,
    kycStatus: user.verification?.identity?.status ?? user.kyc?.status,
    kycVerifiedAt: user.verification?.identity?.verifiedAt
      ? new Date(user.verification.identity.verifiedAt).toISOString()
      : undefined,
    idDigital,
    agentOnboardingStatus: user.agent?.status,
    agentActivatedAt: user.agent?.activatedAt
      ? new Date(user.agent.activatedAt).toISOString()
      : undefined,
    createdAt: user.createdAt ? new Date(user.createdAt).toISOString() : undefined,
  };
}

type SnapshotCreateInput = {
  disputeId: string;
  transaction: ITransaction & { _id: Types.ObjectId | string };
  openedByUserId: string;
  reason: string;
  category: string;
  openedAt: Date;
  /** Fotos opcionales del comprador (solo imágenes; sin video/audio). */
  photoStorageKeys?: string[];
};

/**
 * Genera y persiste el expediente de evidencia al abrir una disputa.
 * No incluye upload de video/audio.
 */
export class DisputeEvidenceSnapshotService {
  async captureOnOpen(input: SnapshotCreateInput): Promise<{ evidenceIds: string[] }> {
    const tx = input.transaction;
    const parties = resolveTransactionPartyIds(
      tx as Parameters<typeof resolveTransactionPartyIds>[0],
    );
    const uploadedBy = new Types.ObjectId(input.openedByUserId);
    const disputeId = new Types.ObjectId(input.disputeId);
    const createdIds: Types.ObjectId[] = [];

    const save = async (doc: {
      kind: EvidenceKind;
      type: EvidenceType;
      title: string;
      description?: string;
      payload?: Record<string, unknown>;
      storageKey?: string;
      mimeType?: string;
    }) => {
      const created = await EvidenceModel.create({
        transaction: tx._id,
        dispute: disputeId,
        uploadedBy,
        kind: doc.kind,
        type: doc.type,
        status: EvidenceStatus.SUBMITTED,
        title: doc.title,
        description: doc.description,
        payload: doc.payload,
        storageKey:
          doc.storageKey ?? `snapshot://${input.disputeId}/${doc.kind.toLowerCase()}`,
        mimeType: doc.mimeType ?? (doc.payload ? 'application/json' : undefined),
      });
      createdIds.push(created._id as Types.ObjectId);
    };

    try {
      const [buyer, seller, agent] = await Promise.all([
        parties.buyerId
          ? loadUserDossier(parties.buyerId, 'BUYER')
          : Promise.resolve(undefined),
        parties.sellerId
          ? loadUserDossier(parties.sellerId, 'SELLER')
          : Promise.resolve(undefined),
        parties.agentId
          ? loadUserDossier(parties.agentId, 'AGENT')
          : Promise.resolve(undefined),
      ]);

      await save({
        kind: EvidenceKind.OPENING,
        type: EvidenceType.DOCUMENT,
        title: 'Apertura de disputa',
        description: 'Quién abrió el reclamo, cuándo y el motivo declarado.',
        payload: {
          openedByUserId: input.openedByUserId,
          openedAt: input.openedAt.toISOString(),
          reason: input.reason,
          category: input.category,
          transactionCode: tx.code,
          transactionId: String(tx._id),
        },
      });

      await save({
        kind: EvidenceKind.PARTICIPANTS,
        type: EvidenceType.DOCUMENT,
        title: 'Ficha de participantes',
        description:
          'Datos de comprador, vendedor y agente al momento de abrir la disputa (documentos enmascarados).',
        payload: {
          capturedAt: input.openedAt.toISOString(),
          buyer,
          seller,
          agent,
          participants: (tx.participants ?? []).map((p) => ({
            userId: String(p.user),
            role: p.role,
            status: p.status,
            invitedAt: p.invitedAt ? new Date(p.invitedAt).toISOString() : undefined,
            respondedAt: p.respondedAt
              ? new Date(p.respondedAt).toISOString()
              : undefined,
          })),
        },
      });

      await save({
        kind: EvidenceKind.IDENTITY,
        type: EvidenceType.DOCUMENT,
        title: 'Identidad del Agente',
        description:
          'Estado KYC e Identidad Digital del agente (garantía de confianza de la operación).',
        payload: {
          capturedAt: input.openedAt.toISOString(),
          agentId: parties.agentId,
          agent: agent ?? null,
          hasAcceptedAgent: Boolean(
            (tx.participants ?? []).some(
              (p) =>
                p.role === ParticipantRole.INTERMEDIARY &&
                p.status === ParticipantStatus.ACCEPTED,
            ),
          ),
        },
      });

      await save({
        kind: EvidenceKind.OPERATION,
        type: EvidenceType.DOCUMENT,
        title: 'Snapshot de la operación',
        description: 'Estado, montos, checklist, verificación y entrega al abrir la disputa.',
        payload: {
          capturedAt: input.openedAt.toISOString(),
          code: tx.code,
          title: tx.title,
          description: tx.description,
          status: tx.status,
          fundingMode: tx.fundingMode,
          amountCents: tx.amountCents,
          currency: tx.currency,
          feePayer: tx.feePayer,
          confiAnzaCents: tx.confiAnzaCents,
          initiatedBy: tx.initiatedBy,
          createdBy: String(tx.createdBy),
          fundedAt: tx.fundedAt ? new Date(tx.fundedAt).toISOString() : undefined,
          completedAt: tx.completedAt ? new Date(tx.completedAt).toISOString() : undefined,
          cancelledAt: tx.cancelledAt ? new Date(tx.cancelledAt).toISOString() : undefined,
          disputedAt: tx.disputedAt ? new Date(tx.disputedAt).toISOString() : undefined,
          operationDeadlineAt: tx.operationDeadlineAt
            ? new Date(tx.operationDeadlineAt).toISOString()
            : undefined,
          returnInstructions: tx.returnInstructions,
          party: {
            buyer: partyInstructionsSnapshot(tx.party?.buyer),
            seller: partyInstructionsSnapshot(tx.party?.seller),
          },
          agentVerification: tx.agentVerification
            ? {
                allPassed: tx.agentVerification.allPassed,
                completedAt: tx.agentVerification.completedAt
                  ? new Date(tx.agentVerification.completedAt).toISOString()
                  : undefined,
                completedBy: tx.agentVerification.completedBy
                  ? String(tx.agentVerification.completedBy)
                  : undefined,
                note: tx.agentVerification.note,
                buyerDecision: tx.agentVerification.buyerDecision,
                buyerDecidedAt: tx.agentVerification.buyerDecidedAt
                  ? new Date(tx.agentVerification.buyerDecidedAt).toISOString()
                  : undefined,
              }
            : undefined,
          deliveryConfirmation: tx.deliveryConfirmation
            ? {
                buyerArrivalConfirmedAt: tx.deliveryConfirmation.buyerArrivalConfirmedAt
                  ? new Date(tx.deliveryConfirmation.buyerArrivalConfirmedAt).toISOString()
                  : undefined,
                agentDeliveryConfirmedAt: tx.deliveryConfirmation.agentDeliveryConfirmedAt
                  ? new Date(
                      tx.deliveryConfirmation.agentDeliveryConfirmedAt,
                    ).toISOString()
                  : undefined,
                firstConfirmedAt: tx.deliveryConfirmation.firstConfirmedAt
                  ? new Date(tx.deliveryConfirmation.firstConfirmedAt).toISOString()
                  : undefined,
                autoReleaseAt: tx.deliveryConfirmation.autoReleaseAt
                  ? new Date(tx.deliveryConfirmation.autoReleaseAt).toISOString()
                  : undefined,
                buyerArrivalAuto: tx.deliveryConfirmation.buyerArrivalAuto,
                agentDeliveryAuto: tx.deliveryConfirmation.agentDeliveryAuto,
              }
            : undefined,
        },
      });

      await save({
        kind: EvidenceKind.STATUS_HISTORY,
        type: EvidenceType.DOCUMENT,
        title: 'Historial de estados',
        description: 'Timeline de cambios de estado de la operación hasta la disputa.',
        payload: {
          capturedAt: input.openedAt.toISOString(),
          events: (tx.statusHistory ?? []).map((ev) => ({
            status: ev.status,
            changedAt: ev.changedAt ? new Date(ev.changedAt).toISOString() : undefined,
            changedBy: ev.changedBy ? String(ev.changedBy) : undefined,
            note: ev.note,
          })),
        },
      });

      const hold = await PaymentModel.findOne({
        transaction: tx._id,
        type: PaymentType.ESCROW_HOLD,
        deletedAt: null,
      })
        .sort({ createdAt: -1 })
        .lean()
        .exec();

      await save({
        kind: EvidenceKind.PAYMENT,
        type: EvidenceType.DOCUMENT,
        title: 'Pago de la contratación del Agente',
        description: 'Datos del cobro (Mercado Pago / hold) al abrir la disputa.',
        payload: {
          capturedAt: input.openedAt.toISOString(),
          hold: hold
            ? {
                id: String(hold._id),
                status: hold.status,
                provider: hold.provider,
                amountCents: hold.amountCents,
                currency: hold.currency,
                externalId: hold.externalId,
                authorizedAt: hold.authorizedAt
                  ? new Date(hold.authorizedAt).toISOString()
                  : undefined,
                capturedAt: hold.capturedAt
                  ? new Date(hold.capturedAt).toISOString()
                  : undefined,
                refundedAt: hold.refundedAt
                  ? new Date(hold.refundedAt).toISOString()
                  : undefined,
                metadata: {
                  preferenceId:
                    typeof hold.metadata?.preferenceId === 'string'
                      ? hold.metadata.preferenceId
                      : undefined,
                  mpPaymentId:
                    typeof hold.metadata?.mpPaymentId === 'string'
                      ? hold.metadata.mpPaymentId
                      : undefined,
                  phase:
                    typeof hold.metadata?.phase === 'string'
                      ? hold.metadata.phase
                      : undefined,
                  fundingMode:
                    typeof hold.metadata?.fundingMode === 'string'
                      ? hold.metadata.fundingMode
                      : undefined,
                },
              }
            : null,
        },
      });

      const chats = await ChatModel.find({
        transaction: tx._id,
        deletedAt: null,
      })
        .select('_id channel participants createdAt')
        .lean()
        .exec();

      const chatPayload = await Promise.all(
        chats.map(async (chat) => {
          const messages = await MessageModel.find({
            chat: chat._id,
            deletedAt: null,
          })
            .sort({ createdAt: 1 })
            .limit(MAX_CHAT_MESSAGES)
            .select('sender type body attachments createdAt')
            .lean()
            .exec();
          return {
            chatId: String(chat._id),
            channel: chat.channel,
            participantIds: (chat.participants ?? []).map((id) => String(id)),
            messageCount: messages.length,
            truncated: messages.length >= MAX_CHAT_MESSAGES,
            messages: messages.map((m) => ({
              id: String(m._id),
              senderId: String(m.sender),
              type: m.type,
              body: m.body,
              createdAt: m.createdAt ? new Date(m.createdAt).toISOString() : undefined,
              attachments: (m.attachments ?? []).map((a) => ({
                fileName: a.fileName,
                mimeType: a.mimeType,
                storageKey: a.storageKey,
                sizeBytes: a.sizeBytes,
                // No re-exponer URLs firmadas largas; basta la clave.
              })),
            })),
          };
        }),
      );

      await save({
        kind: EvidenceKind.CHAT,
        type: EvidenceType.DOCUMENT,
        title: 'Chats de la operación',
        description: 'Transcripción de mensajes asociados a la operación al abrir la disputa.',
        payload: {
          capturedAt: input.openedAt.toISOString(),
          chats: chatPayload,
        },
      });

      let productImages: Array<{ url?: string; storageKey?: string; alt?: string }> = [];
      if (tx.product) {
        const product = await ProductModel.findById(tx.product)
          .select('title images')
          .lean()
          .exec();
        productImages = (product?.images ?? []).map((img) => ({
          url: img.url,
          storageKey: img.storageKey,
          alt: img.alt ?? product?.title,
        }));
      }

      await save({
        kind: EvidenceKind.MEDIA,
        type: EvidenceType.DOCUMENT,
        title: 'Media de la operación',
        description: 'Fotos del producto / pedido ya cargadas en la operación.',
        payload: {
          capturedAt: input.openedAt.toISOString(),
          productId: tx.product ? String(tx.product) : undefined,
          productImages,
          productTitleBuyer: tx.party?.buyer?.productTitle,
          productTitleSeller: tx.party?.seller?.productTitle,
        },
      });

      const photoKeys = (input.photoStorageKeys ?? [])
        .map((k) => k.trim())
        .filter(Boolean)
        .slice(0, MAX_PHOTO_ATTACHMENTS);

      for (const [index, storageKey] of photoKeys.entries()) {
        if (!storageKey.startsWith(`evidence/${input.openedByUserId}/`)) {
          logger.warn('dispute evidence photo rejected: storageKey inválido', {
            disputeId: input.disputeId,
            storageKey,
          });
          continue;
        }
        await save({
          kind: EvidenceKind.PHOTO_ATTACHMENT,
          type: EvidenceType.PHOTO,
          title: `Foto adjunta ${index + 1}`,
          description: 'Foto enviada por el comprador al abrir la disputa (sin video/audio).',
          storageKey,
          mimeType: 'image/jpeg',
          payload: {
            attachedAt: input.openedAt.toISOString(),
            attachedBy: input.openedByUserId,
          },
        });
      }

      if (createdIds.length > 0) {
        await TransactionModel.updateOne(
          { _id: tx._id },
          { $addToSet: { evidenceIds: { $each: createdIds } } },
        ).exec();
      }
    } catch (error) {
      logger.error('dispute evidence snapshot failed', {
        error: error instanceof Error ? error.message : String(error),
        disputeId: input.disputeId,
        transactionId: String(tx._id),
      });
      // No bloquea la apertura de la disputa: el expediente se intenta completar best-effort.
    }

    return { evidenceIds: createdIds.map((id) => String(id)) };
  }

  async listForDispute(disputeId: string) {
    const items = await EvidenceModel.find({
      dispute: disputeId,
      deletedAt: null,
    })
      .sort({ createdAt: 1 })
      .lean()
      .exec();

    const storageReady = isObjectStorageConfigured();

    return Promise.all(
      items.map(async (row) => {
        let signedUrl: string | undefined;
        const key = row.storageKey?.trim();
        if (
          storageReady &&
          key &&
          !key.startsWith('snapshot://') &&
          row.type === EvidenceType.PHOTO
        ) {
          try {
            signedUrl = await createPresignedGet(key, 15 * 60);
          } catch {
            /* ignore */
          }
        }
        return {
          id: String(row._id),
          kind: row.kind,
          type: row.type,
          status: row.status,
          title: row.title,
          description: row.description,
          storageKey: row.storageKey,
          mimeType: row.mimeType,
          payload: row.payload as Record<string, unknown> | undefined,
          signedUrl,
          createdAt: row.createdAt.toISOString(),
        };
      }),
    );
  }
}

export const disputeEvidenceSnapshotService = new DisputeEvidenceSnapshotService();
