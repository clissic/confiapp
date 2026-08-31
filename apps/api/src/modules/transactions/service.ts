import { randomBytes } from 'node:crypto';

import {
  NotificationActionStatus,
  NotificationChannel,
  NotificationType,
  ParticipantRole,
  ParticipantStatus,
  ProductCategory,
  ProductStatus,
  TransactionInitiator,
  TransactionStatus,
  type IProduct,
  type ITransaction,
  type TransactionMeetingLocation,
  type TransactionPartyInstructions,
} from '@confiapp/database';
import {
  computeIntermediationFees,
  IntermediationFeeError,
  type FeePayer,
} from '@confiapp/shared';
import type { HydratedDocument } from 'mongoose';
import { Types } from 'mongoose';

import { NotificationModel, ProductModel, UserModel } from '../../database/models';
import { env } from '../../shared/config/env';
import { AppError, ForbiddenError, NotFoundError, ValidationError } from '../../shared/errors/app-error';
import { generateOpaqueToken, hashToken } from '../../utils/crypto-tokens';
import type { ActiveDisputeDto } from '../disputes/dto';
import { DisputesRepository, mapActiveDisputeDto } from '../disputes/repository';
import { notificationsService } from '../notifications/service';

import { diffBuyerProposalVsSellerConfirm } from './buyer-proposal-diff';
import {
  mapDeliveryConfirmationToDto,
  deliveryAutoReleaseNotice,
  resolveTransactionPartyIds,
  stampFirstDeliveryConfirmationDeadline,
} from './delivery-deadline';
import type {
  AcceptPurchaseDto,
  ConfirmSaleProductDto,
  CreateSellerTransactionDto,
  CreateTransactionDto,
  InvitePreviewDto,
  MeetingLocationDto,
  PartyInstructionsDto,
  TransactionChecklistItemDto,
  TransactionDto,
  TransactionProductDto,
  TransactionsStatusDto,
  ViewerPartyRole,
} from './dto';
import {
  assertNotPastDeadline,
  computeOperationDeadline,
} from './operation-deadline';
import { TransactionsRepository, type TransactionDocument } from './repository';
import { assertTransition } from './state-machine';
import type {
  AcceptPurchaseBody,
  ConfirmSaleBody,
  CreateSellerTransactionBody,
} from './validation';

function toAmountCents(amount: number): number {
  return Math.round(amount * 100);
}

function isInviteExpired(expiresAt?: Date | null): boolean {
  if (!expiresAt) return true;
  return expiresAt.getTime() < Date.now();
}

function buildShareUrl(rawToken: string): string {
  return `${env.APP_URL.replace(/\/$/, '')}/operaciones/unirse/${encodeURIComponent(rawToken)}`;
}

function assertFeeAffordable(
  productCents: number,
  currency: string,
  feePayer: FeePayer | string,
): void {
  try {
    computeIntermediationFees({
      productCents,
      currency,
      feePayer: feePayer as FeePayer,
      uyuPerUsd: env.USD_UYU_RATE,
      platformCommissionBps: env.PAYMENTS_PLATFORM_FEE_BPS,
      agentCommissionBps: env.PAYMENTS_AGENT_FEE_BPS,
    });
  } catch (error) {
    if (error instanceof IntermediationFeeError) {
      throw new ValidationError(error.message);
    }
    throw error;
  }
}

async function generateUniqueCode(
  repository: TransactionsRepository,
): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = `CONF-${randomBytes(4).toString('hex').toUpperCase()}`;
    if (!(await repository.codeExists(code))) return code;
  }
  throw new AppError(500, 'No se pudo generar un código único', undefined, 'CODE_GENERATION_FAILED');
}

function isParticipant(tx: HydratedDocument<ITransaction>, userId: string): boolean {
  const createdBy = String(tx.createdBy);
  if (createdBy === userId) return true;
  return tx.participants.some((p) => String(p.user) === userId);
}

function hasAcceptedCounterparty(tx: HydratedDocument<ITransaction>): boolean {
  return tx.participants.some(
    (p) =>
      p.role === ParticipantRole.COUNTERPARTY &&
      p.status === ParticipantStatus.ACCEPTED,
  );
}

function getInitiatedBy(tx: HydratedDocument<ITransaction>): TransactionInitiator {
  return tx.initiatedBy ?? TransactionInitiator.BUYER;
}

function buildChecklistItems(
  texts?: string[],
): Array<{ id: string; text: string; done: boolean }> | undefined {
  if (!texts?.length) return undefined;
  const items = texts
    .map((text) => text.trim())
    .filter(Boolean)
    .slice(0, 20)
    .map((text) => ({
      id: randomBytes(8).toString('hex'),
      text,
      done: false,
    }));
  return items.length ? items : undefined;
}

function normalizeChecklist(raw: unknown): TransactionChecklistItemDto[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  return raw.map((item, index) => {
    if (typeof item === 'string') {
      return {
        id: `legacy-${index}`,
        text: item,
        done: false,
      };
    }
    if (item && typeof item === 'object') {
      const record = item as {
        id?: string;
        text?: string;
        done?: boolean;
        doneAt?: Date | string;
      };
      return {
        id: record.id?.trim() || `legacy-${index}`,
        text: String(record.text ?? '').trim() || `Ítem ${index + 1}`,
        done: Boolean(record.done),
        doneAt:
          record.doneAt instanceof Date
            ? record.doneAt.toISOString()
            : typeof record.doneAt === 'string'
              ? record.doneAt
              : undefined,
      };
    }
    return { id: `legacy-${index}`, text: String(item), done: false };
  });
}

function toMeetingLocationDto(
  loc?: TransactionMeetingLocation | null,
): MeetingLocationDto | undefined {
  if (
    !loc ||
    loc.type !== 'Point' ||
    !Array.isArray(loc.coordinates) ||
    loc.coordinates.length !== 2
  ) {
    return undefined;
  }
  return {
    type: 'Point',
    coordinates: [loc.coordinates[0]!, loc.coordinates[1]!],
    label: loc.label?.trim() || 'Punto de entrega',
  };
}

function toProductDto(
  product: HydratedDocument<IProduct> | (IProduct & { _id: unknown }),
): TransactionProductDto {
  return {
    id: String(product._id),
    title: product.title,
    description: product.description,
    condition: product.condition,
    category: product.category,
    status: product.status,
    estimatedValueCents: product.estimatedValueCents,
    currency: product.currency,
    images: (product.images ?? []).map((img, index) => ({
      url: img.url,
      alt: img.alt,
      sortOrder: img.sortOrder ?? index,
    })),
  };
}

function resolveClientMeetingLocation(input: {
  meetingLocationMode?: 'MAP' | 'CHAT' | 'HOME';
  meetingLocation?: { type: 'Point'; coordinates: [number, number]; label: string };
}): TransactionMeetingLocation | undefined {
  const mode = input.meetingLocationMode ?? 'CHAT';
  if (mode === 'CHAT') return undefined;
  if (!input.meetingLocation) return undefined;
  return {
    type: 'Point',
    coordinates: input.meetingLocation.coordinates,
    label: input.meetingLocation.label.trim(),
  };
}

function buildPartySide(input: {
  conditionsSummary: string;
  checklist?: string[];
  meetingLocationMode?: 'MAP' | 'CHAT' | 'HOME';
  meetingLocation?: { type: 'Point'; coordinates: [number, number]; label: string };
  productTitle?: string;
  productDescription?: string;
}): TransactionPartyInstructions {
  const meetingLocation = resolveClientMeetingLocation(input);
  return {
    conditionsSummary: input.conditionsSummary.trim(),
    checklist: buildChecklistItems(input.checklist),
    ...(meetingLocation ? { meetingLocation } : {}),
    ...(input.productTitle?.trim() ? { productTitle: input.productTitle.trim() } : {}),
    ...(input.productDescription?.trim()
      ? { productDescription: input.productDescription.trim() }
      : {}),
  };
}

/** Hidrata party desde campos legacy si aún no existe. */
function resolvePartySides(tx: HydratedDocument<ITransaction> | TransactionDocument): {
  buyer?: TransactionPartyInstructions;
  seller?: TransactionPartyInstructions;
} {
  const buyer = tx.party?.buyer;
  const seller = tx.party?.seller;
  if (buyer || seller) {
    return { buyer, seller };
  }

  const legacySide: TransactionPartyInstructions = {
    conditionsSummary: tx.conditions?.summary ?? '',
    checklist: tx.conditions?.checklist,
    meetingLocation: tx.meetingLocation,
  };
  const initiatedBy = getInitiatedBy(tx);
  if (initiatedBy === TransactionInitiator.SELLER) {
    return {
      seller: {
        ...legacySide,
        productTitle: undefined,
        productDescription: undefined,
      },
    };
  }
  return { buyer: legacySide };
}

function mapPartyDto(
  side: TransactionPartyInstructions | undefined,
  mode: 'full' | 'public',
): PartyInstructionsDto | undefined {
  if (!side) return undefined;
  if (mode === 'public') {
    const productTitle = side.productTitle?.trim();
    const productDescription = side.productDescription?.trim();
    if (!productTitle && !productDescription) return undefined;
    return {
      ...(productTitle ? { productTitle } : {}),
      ...(productDescription ? { productDescription } : {}),
    };
  }
  return {
    conditionsSummary: side.conditionsSummary,
    checklist: normalizeChecklist(side.checklist),
    meetingLocation: toMeetingLocationDto(side.meetingLocation),
    ...(side.productTitle?.trim() ? { productTitle: side.productTitle.trim() } : {}),
    ...(side.productDescription?.trim()
      ? { productDescription: side.productDescription.trim() }
      : {}),
  };
}

function resolveViewerRole(
  tx: HydratedDocument<ITransaction> | TransactionDocument,
  viewerUserId?: string,
): ViewerPartyRole {
  if (!viewerUserId) return null;

  const isAgent = tx.participants.some(
    (p) =>
      String(p.user) === viewerUserId &&
      p.role === ParticipantRole.INTERMEDIARY &&
      p.status === ParticipantStatus.ACCEPTED,
  );
  if (isAgent) return 'AGENT';

  const initiatedBy = getInitiatedBy(tx);
  const isCreator = String(tx.createdBy) === viewerUserId;
  const participant = tx.participants.find((p) => String(p.user) === viewerUserId);

  if (isCreator || participant?.role === ParticipantRole.CREATOR) {
    return initiatedBy === TransactionInitiator.SELLER ? 'SELLER' : 'BUYER';
  }
  if (participant?.role === ParticipantRole.COUNTERPARTY) {
    return initiatedBy === TransactionInitiator.SELLER ? 'BUYER' : 'SELLER';
  }
  return null;
}

function toDto(
  tx: HydratedDocument<ITransaction> | TransactionDocument,
  options?: {
    shareUrl?: string;
    product?: TransactionProductDto;
    viewerUserId?: string;
    activeDispute?: ActiveDisputeDto;
  },
): TransactionDto {
  const expiresAt = tx.inviteExpiresAt;
  const viewerRole = resolveViewerRole(tx, options?.viewerUserId);
  const sides = resolvePartySides(tx);

  let partyBuyer: PartyInstructionsDto | undefined;
  let partySeller: PartyInstructionsDto | undefined;
  let returnInstructions: string | undefined;
  let legacyConditions = {
    summary: '',
    checklist: [] as TransactionChecklistItemDto[],
  };
  let legacyMeeting: MeetingLocationDto | undefined;

  if (viewerRole === 'AGENT') {
    partyBuyer = mapPartyDto(sides.buyer, 'full');
    partySeller = mapPartyDto(sides.seller, 'full');
    returnInstructions = tx.returnInstructions?.trim() || undefined;
    legacyConditions = {
      summary: sides.buyer?.conditionsSummary || sides.seller?.conditionsSummary || tx.conditions?.summary || '',
      checklist: [
        ...normalizeChecklist(sides.buyer?.checklist),
        ...normalizeChecklist(sides.seller?.checklist),
      ],
    };
    legacyMeeting =
      toMeetingLocationDto(sides.buyer?.meetingLocation) ||
      toMeetingLocationDto(sides.seller?.meetingLocation) ||
      toMeetingLocationDto(tx.meetingLocation);
  } else if (viewerRole === 'BUYER') {
    partyBuyer = mapPartyDto(sides.buyer, 'full');
    partySeller = mapPartyDto(sides.seller, 'public');
    legacyConditions = {
      summary: sides.buyer?.conditionsSummary || '',
      checklist: normalizeChecklist(sides.buyer?.checklist),
    };
    legacyMeeting = toMeetingLocationDto(sides.buyer?.meetingLocation);
  } else if (viewerRole === 'SELLER') {
    partySeller = mapPartyDto(sides.seller, 'full');
    partyBuyer = mapPartyDto(sides.buyer, 'public');
    legacyConditions = {
      summary: sides.seller?.conditionsSummary || '',
      checklist: normalizeChecklist(sides.seller?.checklist),
    };
    legacyMeeting = toMeetingLocationDto(sides.seller?.meetingLocation);
  } else {
    // Sin rol claro: solo datos públicos de producto por lado.
    partyBuyer = mapPartyDto(sides.buyer, 'public');
    partySeller = mapPartyDto(sides.seller, 'public');
  }

  return {
    id: String(tx._id),
    code: tx.code,
    title: tx.title,
    description: tx.description,
    createdBy: String(tx.createdBy),
    initiatedBy: getInitiatedBy(tx),
    status: tx.status,
    conditions: legacyConditions,
    amountCents: tx.amountCents,
    currency: tx.currency,
    feePayer: tx.feePayer,
    confiAnzaCents: tx.confiAnzaCents,
    confiAnzaCurrency: tx.confiAnzaCurrency,
    meetingLocation: legacyMeeting,
    party: {
      ...(partyBuyer ? { buyer: partyBuyer } : {}),
      ...(partySeller ? { seller: partySeller } : {}),
    },
    returnInstructions,
    viewerRole: viewerRole ?? undefined,
    agentVerification: tx.agentVerification?.completedAt
      ? {
          allPassed: Boolean(tx.agentVerification.allPassed),
          completedAt: tx.agentVerification.completedAt.toISOString(),
          ...(tx.agentVerification.note?.trim()
            ? { note: tx.agentVerification.note.trim() }
            : {}),
          ...(tx.agentVerification.buyerDecision
            ? {
                buyerDecision: tx.agentVerification.buyerDecision,
                buyerDecidedAt: tx.agentVerification.buyerDecidedAt?.toISOString(),
              }
            : {}),
        }
      : undefined,
    deliveryConfirmation: mapDeliveryConfirmationToDto(tx.deliveryConfirmation),
    productId: tx.product ? String(tx.product) : undefined,
    product: options?.product,
    participants: tx.participants.map((p) => ({
      userId: p.user ? String(p.user) : undefined,
      role: p.role,
      status: p.status,
      invitedAt: p.invitedAt.toISOString(),
      respondedAt: p.respondedAt?.toISOString(),
    })),
    statusHistory: (tx.statusHistory ?? []).map((event) => ({
      status: event.status,
      changedAt: event.changedAt.toISOString(),
      note: event.note,
    })),
    invite: {
      shareUrl: options?.shareUrl,
      expiresAt: expiresAt?.toISOString(),
      isExpired: isInviteExpired(expiresAt),
    },
    operationDeadlineAt: tx.operationDeadlineAt?.toISOString(),
    pendingBuyerChanges: tx.pendingBuyerChanges?.map((c) => ({
      field: c.field,
      from: c.from,
      to: c.to,
    })),
    activeDispute: options?.activeDispute,
    createdAt: tx.createdAt.toISOString(),
    updatedAt: tx.updatedAt.toISOString(),
  };
}

async function loadProductDto(
  productId?: { toString(): string } | string | null,
): Promise<TransactionProductDto | undefined> {
  if (!productId) return undefined;
  const product = await ProductModel.findOne({
    _id: productId,
    deletedAt: null,
  })
    .lean()
    .exec();
  if (!product) return undefined;
  return toProductDto(product);
}

async function loadProductsMap(
  productIds: Array<{ toString(): string } | string | null | undefined>,
): Promise<Map<string, TransactionProductDto>> {
  const ids = [
    ...new Set(
      productIds
        .filter(Boolean)
        .map((id) => String(id)),
    ),
  ];
  if (!ids.length) return new Map();
  const products = await ProductModel.find({
    _id: { $in: ids },
    deletedAt: null,
  })
    .lean()
    .exec();
  return new Map(products.map((p) => [String(p._id), toProductDto(p)]));
}

function buildInvitePair() {
  const rawToken = generateOpaqueToken(32);
  return {
    rawToken,
    inviteTokenHash: hashToken(rawToken),
  };
}

export class TransactionsService {
  constructor(private readonly repository = new TransactionsRepository()) {}

  async getStatus(): Promise<TransactionsStatusDto> {
    return { module: 'transactions', status: 'ready' };
  }

  async create(userId: string, input: CreateTransactionDto): Promise<TransactionDto> {
    const amountCents = toAmountCents(input.amount);
    if (amountCents < 100) {
      throw new ValidationError('El monto mínimo es 1.00');
    }
    assertFeeAffordable(amountCents, (input.currency ?? 'UYU').toUpperCase(), input.feePayer);

    const code = await generateUniqueCode(this.repository);
    const { rawToken, inviteTokenHash } = buildInvitePair();
    const days = input.inviteExpiresInDays ?? 7;
    const inviteExpiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    const partyBuyer = buildPartySide({
      conditionsSummary: input.conditionsSummary,
      checklist: input.checklist,
      meetingLocationMode: input.meetingLocationMode,
      meetingLocation: input.meetingLocation,
      productTitle: input.productTitle,
      productDescription: input.productDescription,
    });

    const created = await this.repository.create({
      code,
      title: input.title.trim(),
      description: input.description?.trim(),
      createdBy: userId,
      initiatedBy: TransactionInitiator.BUYER,
      meetingLocation: partyBuyer.meetingLocation,
      party: { buyer: partyBuyer },
      conditions: {
        summary: partyBuyer.conditionsSummary,
        checklist: buildChecklistItems(input.checklist),
      },
      amountCents,
      currency: (input.currency ?? 'UYU').toUpperCase(),
      feePayer: input.feePayer,
      ...(input.confiAnzaAmount && input.confiAnzaAmount > 0
        ? {
            confiAnzaCents: toAmountCents(input.confiAnzaAmount),
            confiAnzaCurrency: (input.confiAnzaCurrency ?? input.currency ?? 'UYU').toUpperCase(),
          }
        : {}),
      inviteTokenHash,
      inviteExpiresAt,
    });

    const { auditService, AuditAction, AuditOutcome } = await import('../audit');
    auditService.track({
      actor: userId,
      action: AuditAction.CREATE,
      entityType: 'Transaction',
      entityId: String(created._id),
      outcome: AuditOutcome.SUCCESS,
      correlationId: code,
      metadata: {
        code,
        step: 'buyer_create',
        initiatedBy: TransactionInitiator.BUYER,
        amountCents,
        currency: (input.currency ?? 'UYU').toUpperCase(),
        feePayer: input.feePayer,
        status: TransactionStatus.WAITING_PARTICIPANT,
      },
    });
    auditService.track({
      actor: userId,
      action: AuditAction.STATUS_CHANGE,
      entityType: 'Transaction',
      entityId: String(created._id),
      outcome: AuditOutcome.SUCCESS,
      correlationId: code,
      metadata: {
        code,
        step: 'buyer_create',
        from: TransactionStatus.CREATED,
        to: TransactionStatus.WAITING_PARTICIPANT,
        note: 'Enlace de invitación generado — esperando contraparte',
      },
    });

    return toDto(created, { shareUrl: buildShareUrl(rawToken), viewerUserId: userId });
  }

  async createAsSeller(
    userId: string,
    input: CreateSellerTransactionBody | CreateSellerTransactionDto,
  ): Promise<TransactionDto> {
    const amountCents = toAmountCents(input.product.price);
    if (amountCents < 100) {
      throw new ValidationError('El precio mínimo es 1.00');
    }

    const currency = (input.product.currency ?? 'UYU').toUpperCase();
    assertFeeAffordable(amountCents, currency, input.feePayer);
    const code = await generateUniqueCode(this.repository);
    const { rawToken, inviteTokenHash } = buildInvitePair();
    const days = input.inviteExpiresInDays ?? 7;
    const inviteExpiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    const images = input.product.images.map((img, index) => ({
      url: img.url.trim(),
      alt: img.alt?.trim()?.slice(0, 200),
      sortOrder: index,
    }));

    let product;
    try {
      product = await ProductModel.create({
        owner: userId,
        title: input.product.title.trim(),
        description: input.product.description.trim(),
        category: input.product.category ?? ProductCategory.OTHER,
        condition: input.product.condition,
        status: ProductStatus.IN_TRANSACTION,
        images,
        estimatedValueCents: amountCents,
        currency,
      });
    } catch (error) {
      if (error instanceof Error && /longer than the maximum|maxlength/i.test(error.message)) {
        throw new ValidationError(
          'La foto es demasiado pesada. Usá una imagen más liviana (máx. ~1.2 MB) o una URL pública.',
        );
      }
      throw error;
    }

    const partySeller = buildPartySide({
      conditionsSummary: input.conditionsSummary,
      checklist: input.checklist,
      meetingLocationMode: input.meetingLocationMode,
      meetingLocation: input.meetingLocation,
      productTitle: input.product.title,
      productDescription: input.product.description,
    });

    const created = await this.repository.create({
      code,
      title: input.title.trim(),
      description: input.description?.trim(),
      createdBy: userId,
      initiatedBy: TransactionInitiator.SELLER,
      productId: String(product._id),
      meetingLocation: partySeller.meetingLocation,
      party: { seller: partySeller },
      returnInstructions: input.returnInstructions,
      conditions: {
        summary: partySeller.conditionsSummary,
        checklist: buildChecklistItems(input.checklist),
      },
      amountCents,
      currency,
      feePayer: input.feePayer,
      ...(input.confiAnzaAmount && input.confiAnzaAmount > 0
        ? {
            confiAnzaCents: toAmountCents(input.confiAnzaAmount),
            confiAnzaCurrency: (input.confiAnzaCurrency ?? currency).toUpperCase(),
          }
        : {}),
      inviteTokenHash,
      inviteExpiresAt,
    });

    product.activeTransaction = created._id;
    await product.save();

    const { auditService, AuditAction, AuditOutcome } = await import('../audit');
    auditService.track({
      actor: userId,
      action: AuditAction.CREATE,
      entityType: 'Transaction',
      entityId: String(created._id),
      outcome: AuditOutcome.SUCCESS,
      correlationId: code,
      metadata: {
        code,
        step: 'seller_create',
        initiatedBy: TransactionInitiator.SELLER,
        amountCents,
        currency,
        feePayer: input.feePayer,
        productId: String(product._id),
        status: TransactionStatus.WAITING_PARTICIPANT,
      },
    });
    auditService.track({
      actor: userId,
      action: AuditAction.STATUS_CHANGE,
      entityType: 'Transaction',
      entityId: String(created._id),
      outcome: AuditOutcome.SUCCESS,
      correlationId: code,
      metadata: {
        code,
        step: 'seller_create',
        from: TransactionStatus.CREATED,
        to: TransactionStatus.WAITING_PARTICIPANT,
        note: 'Enlace generado para el comprador — esperando aceptación',
      },
    });

    return toDto(created, {
      shareUrl: buildShareUrl(rawToken),
      product: toProductDto(product),
      viewerUserId: userId,
    });
  }

  async listMine(userId: string): Promise<TransactionDto[]> {
    const list = await this.repository.listForUser(userId);
    const products = await loadProductsMap(list.map((tx) => tx.product));
    return list.map((tx) =>
      toDto(tx, {
        product: tx.product ? products.get(String(tx.product)) : undefined,
        viewerUserId: userId,
      }),
    );
  }

  async getByCode(userId: string, code: string): Promise<TransactionDto> {
    const tx = await this.repository.findByCode(code);
    if (!tx) throw new NotFoundError('Operación no encontrada');
    if (!isParticipant(tx, userId)) {
      throw new ForbiddenError('No tenés acceso a esta operación');
    }

    // Heal: si ya hay Agente aceptado y el status quedó en FUNDED, pasar a en curso.
    const hasAcceptedAgent = tx.participants.some(
      (p) =>
        p.role === ParticipantRole.INTERMEDIARY &&
        p.status === ParticipantStatus.ACCEPTED,
    );
    if (hasAcceptedAgent && tx.status === TransactionStatus.FUNDED) {
      assertTransition(tx.status, TransactionStatus.IN_PROGRESS);
      const now = new Date();
      tx.status = TransactionStatus.IN_PROGRESS;
      tx.statusHistory.push({
        status: TransactionStatus.IN_PROGRESS,
        changedAt: now,
        changedBy: new Types.ObjectId(userId),
        note: 'Operación en curso: agente asignado tras el pago protegido',
      });
      await tx.save();
    }

    let activeDispute: ActiveDisputeDto | undefined;
    if (tx.status === TransactionStatus.DISPUTED) {
      const dispute = await new DisputesRepository().findActiveByTransaction(String(tx._id));
      activeDispute = dispute ? mapActiveDisputeDto(dispute) : undefined;
    }

    return toDto(tx, {
      product: await loadProductDto(tx.product),
      viewerUserId: userId,
      activeDispute,
    });
  }

  /** Marca/desmarca un ítem del checklist (solo Agente intermediario aceptado). */
  async toggleChecklistItem(
    userId: string,
    code: string,
    itemId: string,
    done: boolean,
    side?: 'buyer' | 'seller',
  ): Promise<TransactionDto> {
    const tx = await this.repository.findByCode(code);
    if (!tx) throw new NotFoundError('Operación no encontrada');
    if (!isParticipant(tx, userId)) {
      throw new ForbiddenError('No tenés acceso a esta operación');
    }

    const isAgent = tx.participants.some(
      (p) =>
        String(p.user) === userId &&
        p.role === ParticipantRole.INTERMEDIARY &&
        p.status === ParticipantStatus.ACCEPTED,
    );
    if (!isAgent) {
      throw new ForbiddenError('Solo el Agente asignado puede marcar el checklist');
    }

    if (
      tx.status !== TransactionStatus.FUNDED &&
      tx.status !== TransactionStatus.IN_PROGRESS
    ) {
      throw new ValidationError(
        tx.status === TransactionStatus.ACCEPTED
          ? 'El checklist se marca en la entrega, después de que el comprador pague.'
          : 'No se puede actualizar el checklist en el estado actual de la operación.',
        { status: tx.status },
      );
    }

    if (tx.agentVerification?.completedAt) {
      throw new ValidationError('La verificación ya fue finalizada; el checklist quedó cerrado.');
    }

    assertNotPastDeadline(tx);

    const sides = resolvePartySides(tx);
    const resolvedSide: 'buyer' | 'seller' | null = (() => {
      if (side === 'buyer' || side === 'seller') return side;
      const inBuyer = normalizeChecklist(sides.buyer?.checklist).some((i) => i.id === itemId);
      if (inBuyer) return 'buyer';
      const inSeller = normalizeChecklist(sides.seller?.checklist).some((i) => i.id === itemId);
      if (inSeller) return 'seller';
      // Legacy único
      if (normalizeChecklist(tx.conditions.checklist).some((i) => i.id === itemId)) {
        return getInitiatedBy(tx) === TransactionInitiator.SELLER ? 'seller' : 'buyer';
      }
      return null;
    })();

    if (!resolvedSide) {
      throw new NotFoundError('Ítem del checklist no encontrado');
    }

    if (!tx.party) tx.party = {};
    const currentSide = tx.party[resolvedSide] ?? sides[resolvedSide];
    if (!currentSide) {
      throw new ValidationError('Esta operación no tiene checklist en ese lado');
    }

    const normalized = normalizeChecklist(currentSide.checklist);
    if (normalized.length === 0) {
      throw new ValidationError('Esta operación no tiene checklist');
    }

    const index = normalized.findIndex((item) => item.id === itemId);
    if (index < 0) {
      throw new NotFoundError('Ítem del checklist no encontrado');
    }

    const now = new Date();
    const agentOid = new Types.ObjectId(userId);
    const nextChecklist = normalized.map((item) => {
      if (item.id !== itemId) {
        return {
          id: item.id,
          text: item.text,
          done: item.done,
          ...(item.done && item.doneAt ? { doneAt: new Date(item.doneAt) } : {}),
        };
      }
      return {
        id: item.id,
        text: item.text,
        done,
        ...(done ? { doneAt: now, doneBy: agentOid } : {}),
      };
    });

    // Mutar el subdoc in-place: evitar `{ ...mongooseSubdoc }` (rompe validación / geo al save).
    const existingSide = tx.party[resolvedSide];
    if (existingSide) {
      existingSide.checklist = nextChecklist as NonNullable<
        TransactionPartyInstructions['checklist']
      >;
    } else {
      const seed = sides[resolvedSide];
      const meetingLocation = toMeetingLocationDto(seed?.meetingLocation);
      tx.party[resolvedSide] = {
        conditionsSummary: seed?.conditionsSummary ?? '',
        checklist: nextChecklist as NonNullable<TransactionPartyInstructions['checklist']>,
        ...(meetingLocation
          ? {
              meetingLocation: {
                type: 'Point' as const,
                coordinates: meetingLocation.coordinates,
                label: meetingLocation.label ?? 'Punto de entrega',
              },
            }
          : {}),
        ...(seed?.productTitle?.trim() ? { productTitle: seed.productTitle.trim() } : {}),
        ...(seed?.productDescription?.trim()
          ? { productDescription: seed.productDescription.trim() }
          : {}),
      };
    }
    tx.markModified('party');

    // Mantener legacy alineado al lado del iniciador si aplica.
    const initiatorSide =
      getInitiatedBy(tx) === TransactionInitiator.SELLER ? 'seller' : 'buyer';
    if (resolvedSide === initiatorSide) {
      tx.conditions.checklist = nextChecklist as typeof tx.conditions.checklist;
      tx.markModified('conditions');
    }

    await tx.save();

    const { auditService, AuditAction, AuditOutcome } = await import('../audit');
    auditService.track({
      actor: userId,
      actorRole: ParticipantRole.INTERMEDIARY,
      action: AuditAction.UPDATE,
      entityType: 'Transaction',
      entityId: String(tx._id),
      outcome: AuditOutcome.SUCCESS,
      correlationId: tx.code,
      metadata: {
        code: tx.code,
        step: 'agent_checklist_toggle',
        side: resolvedSide,
        itemId,
        done,
        itemText: normalized[index]?.text,
      },
    });

    return toDto(tx, {
      product: await loadProductDto(tx.product),
      viewerUserId: userId,
    });
  }

  /**
   * Cierra la verificación del Agente y notifica al comprador
   * según si todos los ítems del checklist quedaron marcados.
   */
  async finalizeVerification(
    userId: string,
    code: string,
    note?: string,
  ): Promise<TransactionDto> {
    const tx = await this.repository.findByCode(code);
    if (!tx) throw new NotFoundError('Operación no encontrada');
    if (!isParticipant(tx, userId)) {
      throw new ForbiddenError('No tenés acceso a esta operación');
    }

    const isAgent = tx.participants.some(
      (p) =>
        String(p.user) === userId &&
        p.role === ParticipantRole.INTERMEDIARY &&
        p.status === ParticipantStatus.ACCEPTED,
    );
    if (!isAgent) {
      throw new ForbiddenError('Solo el Agente asignado puede finalizar la verificación');
    }

    if (
      tx.status !== TransactionStatus.FUNDED &&
      tx.status !== TransactionStatus.IN_PROGRESS
    ) {
      throw new ValidationError(
        'Solo se puede finalizar la verificación con la operación en curso o con pago protegido.',
        { status: tx.status },
      );
    }

    if (tx.agentVerification?.completedAt) {
      throw new ValidationError('La verificación ya fue finalizada.');
    }

    assertNotPastDeadline(tx);

    // Si el agente ya opera y el status quedó en FUNDED (legacy), avanzar a en curso.
    if (tx.status === TransactionStatus.FUNDED) {
      assertTransition(tx.status, TransactionStatus.IN_PROGRESS);
      tx.status = TransactionStatus.IN_PROGRESS;
      tx.statusHistory.push({
        status: TransactionStatus.IN_PROGRESS,
        changedAt: new Date(),
        changedBy: new Types.ObjectId(userId),
        note: 'Operación en curso: agente en verificación del producto',
      });
    }

    const sides = resolvePartySides(tx);
    const items = [
      ...normalizeChecklist(sides.buyer?.checklist),
      ...normalizeChecklist(sides.seller?.checklist),
      ...(sides.buyer || sides.seller
        ? []
        : normalizeChecklist(tx.conditions?.checklist)),
    ];
    if (!items.length) {
      throw new ValidationError('No hay checklist para verificar en esta operación.');
    }

    const allPassed = items.every((item) => item.done);
    const trimmedNote = note?.trim() ? note.trim().slice(0, 2000) : undefined;
    const now = new Date();
    tx.agentVerification = {
      allPassed,
      completedAt: now,
      completedBy: new Types.ObjectId(userId),
      ...(trimmedNote ? { note: trimmedNote } : {}),
    };
    tx.statusHistory.push({
      status: tx.status,
      changedAt: now,
      changedBy: new Types.ObjectId(userId),
      note: allPassed
        ? 'Agente finalizó la verificación: todos los pasos correctos'
        : 'Agente finalizó la verificación: faltan pasos o no todos fueron aprobados',
    });
    await tx.save();

    const initiatedBy = getInitiatedBy(tx);
    const buyerId =
      initiatedBy === TransactionInitiator.BUYER
        ? String(tx.createdBy)
        : String(
            tx.participants.find((p) => p.role === ParticipantRole.COUNTERPARTY)?.user ?? '',
          );

    if (buyerId) {
      await notificationsService.notify({
        userId: buyerId,
        type: NotificationType.TRANSACTION_UPDATE,
        title: allPassed
          ? 'Verificación completada correctamente'
          : 'Verificación con observaciones',
        body: allPassed
          ? `El Agente confirmó que la verificación de ${tx.code} fue correcta. Revisá la operación para aceptar el producto o rechazarlo y cancelar la compra.`
          : `El Agente indicó que la verificación de ${tx.code} no completó todos los pasos. Revisá la operación para aceptar el producto o rechazarlo y cancelar la compra.`,
        data: {
          href: `/operaciones/${tx.code}`,
          code: tx.code,
          status: tx.status,
          allPassed,
          step: 'agent_verification_finalized',
          hasNote: Boolean(trimmedNote),
        },
        entityType: 'Transaction',
        entityId: String(tx._id),
        channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
      });
    }

    const { auditService, AuditAction, AuditOutcome } = await import('../audit');
    auditService.track({
      actor: userId,
      actorRole: ParticipantRole.INTERMEDIARY,
      action: AuditAction.UPDATE,
      entityType: 'Transaction',
      entityId: String(tx._id),
      outcome: AuditOutcome.SUCCESS,
      correlationId: tx.code,
      metadata: {
        code: tx.code,
        step: 'agent_finalize_verification',
        allPassed,
        checklistCount: items.length,
        hasNote: Boolean(trimmedNote),
      },
    });

    const { realtimeServer } = await import(
      '../../infrastructure/realtime/socket-realtime.server'
    );
    realtimeServer.publish(`transaction:${String(tx._id)}`, 'agent:verification', {
      agentId: userId,
      transactionCode: tx.code,
      allPassed,
      hasNote: Boolean(trimmedNote),
    });

    return toDto(tx, {
      product: await loadProductDto(tx.product),
      viewerUserId: userId,
    });
  }

  /**
   * Comprador acepta el producto tras la verificación del Agente (retiro).
   * No libera fondos: el Agente inicia el viaje hacia el comprador.
   */
  async buyerAcceptProduct(userId: string, code: string): Promise<TransactionDto> {
    const tx = await this.repository.findByCode(code);
    if (!tx) throw new NotFoundError('Operación no encontrada');
    if (!isParticipant(tx, userId)) {
      throw new ForbiddenError('No tenés acceso a esta operación');
    }
    if (resolveViewerRole(tx, userId) !== 'BUYER') {
      throw new ForbiddenError('Solo el comprador puede aceptar el producto');
    }
    if (!tx.agentVerification?.completedAt) {
      throw new ValidationError(
        'Todavía no hay una verificación del Agente para decidir sobre el producto.',
      );
    }
    if (tx.agentVerification.buyerDecision) {
      throw new ValidationError('Ya registraste tu decisión sobre este producto.');
    }
    if (
      tx.status !== TransactionStatus.FUNDED &&
      tx.status !== TransactionStatus.IN_PROGRESS
    ) {
      throw new ValidationError(
        'Solo podés aceptar el producto con la operación en curso o con pago protegido.',
        { status: tx.status },
      );
    }
    assertNotPastDeadline(tx);

    const now = new Date();
    if (tx.status === TransactionStatus.FUNDED) {
      assertTransition(tx.status, TransactionStatus.IN_PROGRESS);
      tx.status = TransactionStatus.IN_PROGRESS;
      tx.statusHistory.push({
        status: TransactionStatus.IN_PROGRESS,
        changedAt: now,
        changedBy: new Types.ObjectId(userId),
        note: 'Operación en curso tras la aceptación del comprador',
      });
    }

    tx.agentVerification.buyerDecision = 'ACCEPTED';
    tx.agentVerification.buyerDecidedAt = now;
    tx.agentVerification.buyerDecidedBy = new Types.ObjectId(userId);
    tx.statusHistory.push({
      status: tx.status,
      changedAt: now,
      changedBy: new Types.ObjectId(userId),
      note: 'Comprador aceptó el producto tras la verificación; el Agente inicia la entrega',
    });
    await tx.save();

    const agentId = String(
      tx.participants.find(
        (p) =>
          p.role === ParticipantRole.INTERMEDIARY &&
          p.status === ParticipantStatus.ACCEPTED,
      )?.user ?? '',
    );
    if (agentId) {
      await notificationsService.notify({
        userId: agentId,
        type: NotificationType.TRANSACTION_UPDATE,
        title: 'El comprador aceptó el producto',
        body: `Podés llevar el producto de ${tx.code} al punto de entrega del comprador.`,
        data: {
          href: `/operaciones/${tx.code}`,
          code: tx.code,
          status: tx.status,
          step: 'buyer_accepted_product',
        },
        entityType: 'Transaction',
        entityId: String(tx._id),
        channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
      });
    }

    const { auditService, AuditAction, AuditOutcome } = await import('../audit');
    auditService.track({
      actor: userId,
      actorRole: ParticipantRole.COUNTERPARTY,
      action: AuditAction.UPDATE,
      entityType: 'Transaction',
      entityId: String(tx._id),
      outcome: AuditOutcome.SUCCESS,
      correlationId: tx.code,
      metadata: {
        code: tx.code,
        step: 'buyer_accept_product',
        allPassed: tx.agentVerification.allPassed,
      },
    });

    return toDto(tx, {
      product: await loadProductDto(tx.product),
      viewerUserId: userId,
    });
  }

  /**
   * Comprador confirma que el producto llegó (punto de entrega).
   * Si el Agente ya confirmó la entrega, se liberan los fondos.
   */
  async buyerConfirmArrival(userId: string, code: string): Promise<TransactionDto> {
    const tx = await this.repository.findByCode(code);
    if (!tx) throw new NotFoundError('Operación no encontrada');
    if (!isParticipant(tx, userId)) {
      throw new ForbiddenError('No tenés acceso a esta operación');
    }
    if (resolveViewerRole(tx, userId) !== 'BUYER') {
      throw new ForbiddenError('Solo el comprador puede confirmar el arribo');
    }
    if (tx.agentVerification?.buyerDecision !== 'ACCEPTED') {
      throw new ValidationError(
        'Primero tenés que aceptar el producto tras la verificación del Agente.',
      );
    }
    if (tx.status !== TransactionStatus.IN_PROGRESS && tx.status !== TransactionStatus.FUNDED) {
      throw new ValidationError('La operación no está en curso para confirmar el arribo.', {
        status: tx.status,
      });
    }
    if (tx.deliveryConfirmation?.buyerArrivalConfirmedAt) {
      throw new ValidationError('Ya confirmaste el arribo del producto.');
    }
    assertNotPastDeadline(tx);

    const now = new Date();
    if (tx.status === TransactionStatus.FUNDED) {
      assertTransition(tx.status, TransactionStatus.IN_PROGRESS);
      tx.status = TransactionStatus.IN_PROGRESS;
    }
    tx.deliveryConfirmation = stampFirstDeliveryConfirmationDeadline(
      {
        ...(tx.deliveryConfirmation ?? {}),
        buyerArrivalConfirmedAt: now,
        buyerArrivalConfirmedBy: new Types.ObjectId(userId),
      },
      now,
    );
    tx.statusHistory.push({
      status: tx.status,
      changedAt: now,
      changedBy: new Types.ObjectId(userId),
      note: 'Comprador confirmó el arribo del producto',
    });
    await tx.save();

    const agentAlready = Boolean(tx.deliveryConfirmation.agentDeliveryConfirmedAt);
    if (agentAlready) {
      const { PaymentsService } = await import('../payments/service');
      await new PaymentsService().releaseEscrow(userId, code);
    } else {
      const agentId = String(
        tx.participants.find(
          (p) =>
            p.role === ParticipantRole.INTERMEDIARY &&
            p.status === ParticipantStatus.ACCEPTED,
        )?.user ?? '',
      );
      if (agentId) {
        await notificationsService.notify({
          userId: agentId,
          type: NotificationType.TRANSACTION_UPDATE,
          title: 'El comprador confirmó el arribo',
          body: `Confirmá la entrega de ${tx.code} para completar la operación.`,
          data: {
            href: `/operaciones/${tx.code}`,
            code: tx.code,
            status: tx.status,
            step: 'buyer_confirmed_arrival',
          },
          entityType: 'Transaction',
          entityId: String(tx._id),
          channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
        });
      }
    }

    const refreshed = await this.repository.findByCode(code);
    if (!refreshed) throw new NotFoundError('Operación no encontrada');
    return toDto(refreshed, {
      product: await loadProductDto(refreshed.product),
      viewerUserId: userId,
    });
  }

  /**
   * Agente confirma la entrega al comprador.
   * Si el comprador ya confirmó el arribo, se liberan los fondos.
   */
  async agentConfirmDelivery(userId: string, code: string): Promise<TransactionDto> {
    const tx = await this.repository.findByCode(code);
    if (!tx) throw new NotFoundError('Operación no encontrada');
    if (!isParticipant(tx, userId)) {
      throw new ForbiddenError('No tenés acceso a esta operación');
    }

    const isAgent = tx.participants.some(
      (p) =>
        String(p.user) === userId &&
        p.role === ParticipantRole.INTERMEDIARY &&
        p.status === ParticipantStatus.ACCEPTED,
    );
    if (!isAgent) {
      throw new ForbiddenError('Solo el Agente asignado puede confirmar la entrega');
    }
    if (tx.agentVerification?.buyerDecision !== 'ACCEPTED') {
      throw new ValidationError(
        'El comprador todavía no aceptó el producto tras la verificación.',
      );
    }
    if (tx.status !== TransactionStatus.IN_PROGRESS && tx.status !== TransactionStatus.FUNDED) {
      throw new ValidationError('La operación no está en curso para confirmar la entrega.', {
        status: tx.status,
      });
    }
    if (tx.deliveryConfirmation?.agentDeliveryConfirmedAt) {
      throw new ValidationError('Ya confirmaste la entrega del producto.');
    }
    assertNotPastDeadline(tx);

    const now = new Date();
    if (tx.status === TransactionStatus.FUNDED) {
      assertTransition(tx.status, TransactionStatus.IN_PROGRESS);
      tx.status = TransactionStatus.IN_PROGRESS;
    }
    tx.deliveryConfirmation = stampFirstDeliveryConfirmationDeadline(
      {
        ...(tx.deliveryConfirmation ?? {}),
        agentDeliveryConfirmedAt: now,
        agentDeliveryConfirmedBy: new Types.ObjectId(userId),
      },
      now,
    );
    tx.statusHistory.push({
      status: tx.status,
      changedAt: now,
      changedBy: new Types.ObjectId(userId),
      note: 'Agente confirmó la entrega del producto al comprador',
    });
    await tx.save();

    const buyerAlready = Boolean(tx.deliveryConfirmation.buyerArrivalConfirmedAt);
    const initiatedBy = getInitiatedBy(tx);
    const buyerId =
      initiatedBy === TransactionInitiator.BUYER
        ? String(tx.createdBy)
        : String(
            tx.participants.find((p) => p.role === ParticipantRole.COUNTERPARTY)?.user ?? '',
          );

    if (buyerAlready) {
      const { PaymentsService } = await import('../payments/service');
      await new PaymentsService().releaseEscrow(userId, code);
    } else if (buyerId) {
      const autoReleaseAt = tx.deliveryConfirmation?.autoReleaseAt;
      await notificationsService.notify({
        userId: buyerId,
        type: NotificationType.TRANSACTION_UPDATE,
        title: 'El Agente confirmó la entrega',
        body: [
          `Confirmá el arribo del producto en ${tx.code} para completar la operación.`,
          deliveryAutoReleaseNotice(autoReleaseAt),
        ].join('\n\n'),
        data: {
          href: `/operaciones/${tx.code}`,
          code: tx.code,
          status: tx.status,
          step: 'agent_confirmed_delivery',
          ...(autoReleaseAt ? { autoReleaseAt: autoReleaseAt.toISOString() } : {}),
        },
        entityType: 'Transaction',
        entityId: String(tx._id),
        channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
      });
    }

    const refreshed = await this.repository.findByCode(code);
    if (!refreshed) throw new NotFoundError('Operación no encontrada');
    return toDto(refreshed, {
      product: await loadProductDto(refreshed.product),
      viewerUserId: userId,
    });
  }

  /**
   * Comprador rechaza el producto tras la verificación → reembolso + cancelación.
   */
  async buyerRejectProduct(userId: string, code: string): Promise<TransactionDto> {
    const tx = await this.repository.findByCode(code);
    if (!tx) throw new NotFoundError('Operación no encontrada');
    if (!isParticipant(tx, userId)) {
      throw new ForbiddenError('No tenés acceso a esta operación');
    }
    if (resolveViewerRole(tx, userId) !== 'BUYER') {
      throw new ForbiddenError('Solo el comprador puede rechazar el producto');
    }
    if (!tx.agentVerification?.completedAt) {
      throw new ValidationError(
        'Todavía no hay una verificación del Agente para decidir sobre el producto.',
      );
    }
    if (tx.agentVerification.buyerDecision) {
      throw new ValidationError('Ya registraste tu decisión sobre este producto.');
    }
    if (
      tx.status !== TransactionStatus.FUNDED &&
      tx.status !== TransactionStatus.IN_PROGRESS
    ) {
      throw new ValidationError(
        'Solo podés rechazar el producto con la operación en curso o con pago protegido.',
        { status: tx.status },
      );
    }
    assertNotPastDeadline(tx);

    const { PaymentsService } = await import('../payments/service');
    await new PaymentsService().refundEscrowAndCancel(
      userId,
      code,
      'Comprador rechazó el producto y canceló la compra',
    );

    const refreshed = await this.repository.findByCode(code);
    if (!refreshed) throw new NotFoundError('Operación no encontrada');
    if (!refreshed.agentVerification) {
      throw new ValidationError('Estado de verificación inconsistente.');
    }

    const now = new Date();
    refreshed.agentVerification.buyerDecision = 'REJECTED';
    refreshed.agentVerification.buyerDecidedAt = now;
    refreshed.agentVerification.buyerDecidedBy = new Types.ObjectId(userId);
    await refreshed.save();

    const { auditService, AuditAction, AuditOutcome } = await import('../audit');
    auditService.track({
      actor: userId,
      actorRole: ParticipantRole.COUNTERPARTY,
      action: AuditAction.UPDATE,
      entityType: 'Transaction',
      entityId: String(refreshed._id),
      outcome: AuditOutcome.SUCCESS,
      correlationId: refreshed.code,
      metadata: {
        code: refreshed.code,
        step: 'buyer_reject_product',
        allPassed: refreshed.agentVerification.allPassed,
      },
    });

    return toDto(refreshed, {
      product: await loadProductDto(refreshed.product),
      viewerUserId: userId,
    });
  }

  async refreshInvite(userId: string, code: string): Promise<TransactionDto> {
    const tx = await this.repository.findByCodeWithInvite(code);
    if (!tx) throw new NotFoundError('Operación no encontrada');
    if (String(tx.createdBy) !== userId) {
      throw new ForbiddenError('Solo quien inició la operación puede regenerar el enlace');
    }
    if (
      tx.status !== TransactionStatus.WAITING_PARTICIPANT &&
      tx.status !== TransactionStatus.CREATED
    ) {
      throw new ValidationError('No se puede regenerar el enlace en el estado actual');
    }

    if (hasAcceptedCounterparty(tx)) {
      throw new ValidationError('La contraparte ya se unió; el enlace ya no es necesario');
    }

    const { rawToken, inviteTokenHash } = buildInvitePair();
    const updated = await this.repository.refreshInvite(
      tx,
      inviteTokenHash,
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    );

    const { auditService, AuditAction, AuditOutcome } = await import('../audit');
    auditService.track({
      actor: userId,
      action: AuditAction.UPDATE,
      entityType: 'Transaction',
      entityId: String(updated._id),
      outcome: AuditOutcome.SUCCESS,
      correlationId: updated.code,
      metadata: { code: updated.code, step: 'invite_refreshed', note: 'invite_refreshed' },
    });

    return toDto(updated, {
      shareUrl: buildShareUrl(rawToken),
      product: await loadProductDto(updated.product),
      viewerUserId: userId,
    });
  }

  async previewInvite(token: string): Promise<InvitePreviewDto> {
    const tx = await this.repository.findByInviteTokenHash(hashToken(token));
    if (!tx) throw new NotFoundError('Enlace de invitación inválido');

    const creator = await UserModel.findById(tx.createdBy)
      .select('fullName displayName')
      .lean()
      .exec();

    const product = await loadProductDto(tx.product);
    const sides = resolvePartySides(tx);
    const initiatedBy = getInitiatedBy(tx);
    const publicSide =
      initiatedBy === TransactionInitiator.SELLER ? sides.seller : sides.buyer;

    return {
      code: tx.code,
      title: tx.title,
      productTitle:
        publicSide?.productTitle?.trim() ||
        product?.title ||
        undefined,
      productDescription:
        publicSide?.productDescription?.trim() ||
        product?.description ||
        undefined,
      amountCents: tx.amountCents,
      currency: tx.currency,
      feePayer: tx.feePayer,
      status: tx.status,
      initiatedBy,
      inviteExpiresAt: tx.inviteExpiresAt?.toISOString(),
      isExpired: isInviteExpired(tx.inviteExpiresAt),
      creatorName: creator?.displayName || creator?.fullName,
      hasProduct: Boolean(tx.product),
      hasCounterparty: hasAcceptedCounterparty(tx),
      product,
    };
  }

  async joinInvite(userId: string, token: string): Promise<TransactionDto> {
    const tx = await this.repository.findByInviteTokenHash(hashToken(token));
    if (!tx) throw new NotFoundError('Enlace de invitación inválido');

    if (getInitiatedBy(tx) === TransactionInitiator.SELLER) {
      throw new ValidationError(
        'Para aceptar la compra enviá tus instrucciones para el Agente (condiciones, checklist y punto de entrega).',
      );
    }

    if (isInviteExpired(tx.inviteExpiresAt)) {
      throw new ValidationError('El enlace de invitación expiró');
    }

    if (
      tx.status !== TransactionStatus.WAITING_PARTICIPANT &&
      tx.status !== TransactionStatus.CREATED
    ) {
      throw new ValidationError('Esta operación ya no acepta nuevos participantes');
    }

    if (String(tx.createdBy) === userId) {
      throw new ValidationError('No podés unirte a tu propia operación con este enlace');
    }

    const already = tx.participants.find((p) => String(p.user) === userId);
    if (already) {
      return toDto(tx, {
        product: await loadProductDto(tx.product),
        viewerUserId: userId,
      });
    }

    if (hasAcceptedCounterparty(tx)) {
      throw new ValidationError('Ya hay una contraparte en esta operación');
    }

    const updated = await this.repository.addCounterparty(
      tx,
      userId,
      'Contraparte se unió mediante enlace de invitación',
    );

    await notificationsService.notify({
      userId: String(updated.createdBy),
      type: NotificationType.TRANSACTION_UPDATE,
      title: 'Alguien se unió a tu operación',
      body: `Una contraparte aceptó la invitación de ${updated.code}. Revisá los siguientes pasos en ConfiApp.`,
      data: {
        href: `/operaciones/${updated.code}`,
        code: updated.code,
        status: updated.status,
      },
      entityType: 'Transaction',
      entityId: String(updated._id),
      channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
    });

    return toDto(updated, {
      product: await loadProductDto(updated.product),
      viewerUserId: userId,
    });
  }

  /**
   * Comprador acepta la compra (flujo iniciado por vendedor).
   * Transición automática: WAITING_PARTICIPANT → ACCEPTED.
   */
  async acceptPurchase(
    userId: string,
    token: string,
    input: AcceptPurchaseBody | AcceptPurchaseDto,
  ): Promise<TransactionDto> {
    const tx = await this.repository.findByInviteTokenHash(hashToken(token));
    if (!tx) throw new NotFoundError('Enlace de invitación inválido');

    if (getInitiatedBy(tx) !== TransactionInitiator.SELLER) {
      throw new ValidationError(
        'Solo se puede aceptar la compra en operaciones iniciadas por el vendedor',
      );
    }

    if (isInviteExpired(tx.inviteExpiresAt)) {
      throw new ValidationError('El enlace de invitación expiró');
    }

    if (!tx.product) {
      throw new ValidationError('La operación no tiene un producto para aceptar');
    }

    if (String(tx.createdBy) === userId) {
      throw new ValidationError('El vendedor no puede aceptar su propia venta como comprador');
    }

    const already = tx.participants.find((p) => String(p.user) === userId);
    if (already && tx.status === TransactionStatus.ACCEPTED) {
      return toDto(tx, {
        product: await loadProductDto(tx.product),
        viewerUserId: userId,
      });
    }

    if (!already && hasAcceptedCounterparty(tx)) {
      throw new ValidationError('Ya hay un comprador en esta operación');
    }

    if (
      tx.status !== TransactionStatus.WAITING_PARTICIPANT &&
      tx.status !== TransactionStatus.CREATED
    ) {
      throw new ValidationError(
        `No se puede aceptar la compra en el estado actual (${tx.status})`,
      );
    }

    if (tx.status === TransactionStatus.CREATED) {
      await this.repository.transitionStatus(tx, TransactionStatus.WAITING_PARTICIPANT, {
        userId,
        note: 'Operación lista para aceptación del comprador',
      });
    }

    const partyBuyer = buildPartySide({
      conditionsSummary: input.conditionsSummary,
      checklist: input.checklist,
      meetingLocationMode: input.meetingLocationMode,
      meetingLocation: input.meetingLocation,
      productTitle: input.productTitle,
      productDescription: input.productDescription,
    });

    const deadline = computeOperationDeadline();
    const feePayer = (input.feePayer ?? tx.feePayer ?? 'BUYER') as FeePayer;
    if (tx.amountCents && tx.currency) {
      assertFeeAffordable(tx.amountCents, tx.currency, feePayer);
    }
    const updated = await this.repository.acceptPurchase(
      tx,
      userId,
      partyBuyer,
      deadline,
      feePayer,
    );

    await notificationsService.notify({
      userId: String(updated.createdBy),
      type: NotificationType.TRANSACTION_UPDATE,
      title: 'El comprador aceptó la compra',
      body: `La operación ${updated.code} quedó aceptada. Pendiente de pago.`,
      data: {
        href: `/operaciones/${updated.code}`,
        code: updated.code,
        status: updated.status,
      },
      entityType: 'Transaction',
      entityId: String(updated._id),
      channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
    });

    return toDto(updated, {
      product: await loadProductDto(updated.product),
      viewerUserId: userId,
    });
  }

  async confirmSale(
    userId: string,
    token: string,
    input: ConfirmSaleBody | ConfirmSaleProductDto,
  ): Promise<TransactionDto> {
    const tx = await this.repository.findByInviteTokenHash(hashToken(token));
    if (!tx) throw new NotFoundError('Enlace de invitación inválido');

    if (getInitiatedBy(tx) === TransactionInitiator.SELLER) {
      throw new ValidationError(
        'Esta operación fue iniciada por el vendedor. El comprador debe unirse con el enlace.',
      );
    }

    if (isInviteExpired(tx.inviteExpiresAt)) {
      throw new ValidationError('El enlace de invitación expiró');
    }

    if (tx.status === TransactionStatus.PENDING_BUYER_CONFIRM) {
      throw new ValidationError(
        'La venta ya fue confirmada con cambios. Esperá la respuesta del comprador.',
      );
    }

    if (
      tx.status !== TransactionStatus.WAITING_PARTICIPANT &&
      tx.status !== TransactionStatus.CREATED
    ) {
      throw new ValidationError('Esta operación ya no acepta confirmación de venta');
    }

    if (String(tx.createdBy) === userId) {
      throw new ValidationError('El comprador no puede confirmar la venta como vendedor');
    }

    if (tx.product) {
      throw new ValidationError('Esta operación ya tiene un producto confirmado');
    }

    const alreadyParticipant = tx.participants.some((p) => String(p.user) === userId);
    if (!alreadyParticipant && hasAcceptedCounterparty(tx)) {
      throw new ValidationError('Ya hay una contraparte en esta operación');
    }

    const amountCents = toAmountCents(input.price);
    if (amountCents < 100) {
      throw new ValidationError('El precio mínimo es 1.00');
    }

    const currency = (input.currency ?? tx.currency ?? 'UYU').toUpperCase();
    assertFeeAffordable(amountCents, currency, input.feePayer);
    const images = input.images.map((img, index) => ({
      url: img.url.trim(),
      alt: img.alt?.trim(),
      sortOrder: index,
    }));
    const category = input.category ?? ProductCategory.OTHER;

    const buyerSide = tx.party?.buyer;
    const changes = diffBuyerProposalVsSellerConfirm(
      {
        title: buyerSide?.productTitle,
        description: buyerSide?.productDescription,
        amountCents: tx.amountCents,
        currency: tx.currency,
        condition: undefined,
        category: undefined,
        feePayer: tx.feePayer,
      },
      {
        title: input.title,
        description: input.description,
        amountCents,
        currency,
        condition: input.condition,
        category,
        feePayer: input.feePayer,
      },
    );
    const hasVariation = changes.length > 0;
    const targetStatus = hasVariation
      ? TransactionStatus.PENDING_BUYER_CONFIRM
      : TransactionStatus.ACCEPTED;
    const deadline = computeOperationDeadline();

    const product = await ProductModel.create({
      owner: userId,
      title: input.title.trim(),
      description: input.description.trim(),
      category,
      condition: input.condition,
      status: ProductStatus.IN_TRANSACTION,
      images,
      estimatedValueCents: amountCents,
      currency,
      activeTransaction: tx._id,
    });

    const partySeller = buildPartySide({
      conditionsSummary: input.conditionsSummary,
      checklist: input.checklist,
      meetingLocationMode: input.meetingLocationMode,
      meetingLocation: input.meetingLocation,
      productTitle: input.title,
      productDescription: input.description,
    });

    const updated = await this.repository.confirmSellerSale(tx, {
      userId,
      productId: String(product._id),
      amountCents,
      currency,
      feePayer: input.feePayer,
      alreadyParticipant,
      partySeller,
      returnInstructions: input.returnInstructions,
      targetStatus,
      pendingBuyerChanges: hasVariation ? changes : undefined,
      operationDeadlineAt: deadline,
    });

    const buyerId = String(updated.createdBy);
    if (hasVariation) {
      await notificationsService.notify({
        userId: buyerId,
        type: NotificationType.TRANSACTION_UPDATE,
        title: 'El vendedor modificó datos de la venta',
        body: `Revisá los cambios en ${updated.code} y aceptá o cancelá la operación.`,
        data: {
          href: `/operaciones/${updated.code}`,
          code: updated.code,
          status: updated.status,
          changes,
        },
        entityType: 'Transaction',
        entityId: String(updated._id),
        channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
        actionStatus: NotificationActionStatus.PENDING,
        expiresAt: deadline,
      });
    } else {
      await notificationsService.notify({
        userId: buyerId,
        type: NotificationType.TRANSACTION_UPDATE,
        title: 'Venta confirmada',
        body: `El vendedor confirmó la venta en ${updated.code}. Pendiente de pago.`,
        data: {
          href: `/operaciones/${updated.code}`,
          code: updated.code,
          status: updated.status,
        },
        entityType: 'Transaction',
        entityId: String(updated._id),
        channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
      });
    }

    return toDto(updated, {
      product: toProductDto(product),
      viewerUserId: userId,
    });
  }

  /** Comprador acepta los cambios del vendedor → ACCEPTED. */
  async buyerConfirmChanges(userId: string, code: string): Promise<TransactionDto> {
    const tx = await this.repository.findByCode(code);
    if (!tx) throw new NotFoundError('Operación no encontrada');
    if (!isParticipant(tx, userId)) {
      throw new ForbiddenError('No tenés acceso a esta operación');
    }
    if (resolveViewerRole(tx, userId) !== 'BUYER') {
      throw new ForbiddenError('Solo el comprador puede confirmar estos cambios');
    }
    if (tx.status !== TransactionStatus.PENDING_BUYER_CONFIRM) {
      throw new ValidationError(
        `La operación no está pendiente de confirmación (actual: ${tx.status})`,
      );
    }
    assertNotPastDeadline(tx);

    const updated = await this.repository.transitionStatus(tx, TransactionStatus.ACCEPTED, {
      userId,
      note: 'Comprador aceptó los cambios del vendedor',
      clearPendingChanges: true,
    });

    await this.resolvePendingBuyerConfirmNotifications(
      updated,
      NotificationActionStatus.ACCEPTED,
    );

    const sellerId = updated.participants.find(
      (p) => p.role === ParticipantRole.COUNTERPARTY && p.status === ParticipantStatus.ACCEPTED,
    );
    if (sellerId) {
      await notificationsService.notify({
        userId: String(sellerId.user),
        type: NotificationType.TRANSACTION_UPDATE,
        title: 'El comprador aceptó tus cambios',
        body: `La operación ${updated.code} quedó aceptada. Pendiente de pago.`,
        data: {
          href: `/operaciones/${updated.code}`,
          code: updated.code,
          status: updated.status,
        },
        entityType: 'Transaction',
        entityId: String(updated._id),
        channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
      });
    }

    return toDto(updated, {
      product: await loadProductDto(updated.product),
      viewerUserId: userId,
    });
  }

  /** Comprador rechaza los cambios → CANCELLED. */
  async buyerRejectChanges(userId: string, code: string): Promise<TransactionDto> {
    const tx = await this.repository.findByCode(code);
    if (!tx) throw new NotFoundError('Operación no encontrada');
    if (!isParticipant(tx, userId)) {
      throw new ForbiddenError('No tenés acceso a esta operación');
    }
    if (resolveViewerRole(tx, userId) !== 'BUYER') {
      throw new ForbiddenError('Solo el comprador puede rechazar estos cambios');
    }
    if (tx.status !== TransactionStatus.PENDING_BUYER_CONFIRM) {
      throw new ValidationError(
        `La operación no está pendiente de confirmación (actual: ${tx.status})`,
      );
    }

    const updated = await this.repository.transitionStatus(tx, TransactionStatus.CANCELLED, {
      userId,
      note: 'Comprador rechazó los cambios del vendedor',
      clearPendingChanges: true,
    });

    await this.resolvePendingBuyerConfirmNotifications(
      updated,
      NotificationActionStatus.REJECTED,
    );

    const sellerId = updated.participants.find(
      (p) => p.role === ParticipantRole.COUNTERPARTY && p.status === ParticipantStatus.ACCEPTED,
    );
    if (sellerId) {
      await notificationsService.notify({
        userId: String(sellerId.user),
        type: NotificationType.TRANSACTION_UPDATE,
        title: 'El comprador rechazó los cambios',
        body: `La operación ${updated.code} fue cancelada.`,
        data: {
          href: `/operaciones/${updated.code}`,
          code: updated.code,
          status: updated.status,
        },
        entityType: 'Transaction',
        entityId: String(updated._id),
        channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
      });
    }

    return toDto(updated, {
      product: await loadProductDto(updated.product),
      viewerUserId: userId,
    });
  }

  /** Job: recordatorio ~48h y auto-liberación tras 72h con una sola confirmación. */
  async autoCompleteStaleDeliveries(limit = 50): Promise<{
    autoReleased: number;
    reminded: number;
    codes: string[];
  }> {
    const codes: string[] = [];
    let reminded = 0;

    const reminderCandidates = await this.repository.findDeliveryReminderCandidates(limit);
    for (const tx of reminderCandidates) {
      try {
        const buyerDone = Boolean(tx.deliveryConfirmation?.buyerArrivalConfirmedAt);
        const agentDone = Boolean(tx.deliveryConfirmation?.agentDeliveryConfirmedAt);
        const parties = resolveTransactionPartyIds(tx);
        const pendingUserId = !buyerDone
          ? parties.buyerId
          : !agentDone
            ? parties.agentId
            : undefined;
        const autoReleaseAt = tx.deliveryConfirmation?.autoReleaseAt;
        if (!pendingUserId || !autoReleaseAt) continue;

        tx.deliveryConfirmation = {
          ...(tx.deliveryConfirmation ?? {}),
          reminder48hSentAt: new Date(),
        };
        await tx.save();

        await notificationsService.notify({
          userId: pendingUserId,
          type: NotificationType.TRANSACTION_UPDATE,
          title: 'Falta tu confirmación de entrega',
          body: [
            `Quedan menos de 24 horas para confirmar ${tx.code}.`,
            deliveryAutoReleaseNotice(autoReleaseAt),
          ].join('\n\n'),
          data: {
            href: `/operaciones/${tx.code}`,
            code: tx.code,
            status: tx.status,
            step: 'delivery_reminder_48h',
            autoReleaseAt: autoReleaseAt.toISOString(),
          },
          entityType: 'Transaction',
          entityId: String(tx._id),
          channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
        });
        reminded += 1;
      } catch {
        // Continuar con las demás.
      }
    }

    const stale = await this.repository.findStaleDeliveryAutoRelease(limit);
    for (const tx of stale) {
      try {
        const buyerDone = Boolean(tx.deliveryConfirmation?.buyerArrivalConfirmedAt);
        const agentDone = Boolean(tx.deliveryConfirmation?.agentDeliveryConfirmedAt);
        if (buyerDone === agentDone) continue;

        const now = new Date();
        const systemActor = new Types.ObjectId(String(tx.createdBy));

        if (!buyerDone && agentDone) {
          tx.deliveryConfirmation = {
            ...(tx.deliveryConfirmation ?? {}),
            buyerArrivalConfirmedAt: now,
            buyerArrivalAuto: true,
          };
          tx.statusHistory.push({
            status: tx.status,
            changedAt: now,
            changedBy: systemActor,
            note: 'Confirmación automática tras 72h sin respuesta del comprador',
          });
        } else {
          tx.deliveryConfirmation = {
            ...(tx.deliveryConfirmation ?? {}),
            agentDeliveryConfirmedAt: now,
            agentDeliveryAuto: true,
          };
          tx.statusHistory.push({
            status: tx.status,
            changedAt: now,
            changedBy: systemActor,
            note: 'Confirmación automática tras 72h sin respuesta del Agente',
          });
        }

        if (tx.status === TransactionStatus.FUNDED) {
          tx.status = TransactionStatus.IN_PROGRESS;
        }
        await tx.save();

        const actorId =
          buyerDone && tx.deliveryConfirmation?.buyerArrivalConfirmedBy
            ? String(tx.deliveryConfirmation.buyerArrivalConfirmedBy)
            : agentDone && tx.deliveryConfirmation?.agentDeliveryConfirmedBy
              ? String(tx.deliveryConfirmation.agentDeliveryConfirmedBy)
              : String(tx.createdBy);

        const { PaymentsService } = await import('../payments/service');
        await new PaymentsService().releaseEscrow(actorId, tx.code);
        codes.push(tx.code);
      } catch {
        // Race o transición inválida; continuar.
      }
    }

    return { autoReleased: codes.length, reminded, codes };
  }

  /** Job: cancela operaciones cuyo operationDeadlineAt ya venció. */
  async expireOperationalDeadlines(limit = 50): Promise<{ expired: number; codes: string[] }> {
    const list = await this.repository.findExpiredOperational(limit);
    const codes: string[] = [];

    for (const tx of list) {
      try {
        const updated = await this.repository.transitionStatus(tx, TransactionStatus.CANCELLED, {
          userId: String(tx.createdBy),
          note: 'Cancelada automáticamente: venció el plazo operativo de 21 días',
          clearPendingChanges: true,
        });
        codes.push(updated.code);

        await this.resolvePendingBuyerConfirmNotifications(
          updated,
          NotificationActionStatus.EXPIRED,
        );

        const recipientIds = new Set<string>([String(updated.createdBy)]);
        for (const p of updated.participants) {
          if (p.status === ParticipantStatus.ACCEPTED) {
            recipientIds.add(String(p.user));
          }
        }

        for (const recipientId of recipientIds) {
          await notificationsService.notify({
            userId: recipientId,
            type: NotificationType.TRANSACTION_UPDATE,
            title: 'Operación cancelada por plazo',
            body: `La operación ${updated.code} se canceló al vencer el plazo de 21 días.`,
            data: {
              href: `/operaciones/${updated.code}`,
              code: updated.code,
              status: updated.status,
              reason: 'OPERATION_DEADLINE_EXPIRED',
            },
            entityType: 'Transaction',
            entityId: String(updated._id),
            channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
          });
        }
      } catch {
        // Continuar con las demás; transición inválida o race.
      }
    }

    return { expired: codes.length, codes };
  }

  private async resolvePendingBuyerConfirmNotifications(
    tx: TransactionDocument,
    actionStatus:
      | typeof NotificationActionStatus.ACCEPTED
      | typeof NotificationActionStatus.REJECTED
      | typeof NotificationActionStatus.EXPIRED,
  ): Promise<void> {
    const pending = await NotificationModel.find({
      entityType: 'Transaction',
      entityId: tx._id,
      type: NotificationType.TRANSACTION_UPDATE,
      actionStatus: NotificationActionStatus.PENDING,
      deletedAt: null,
    }).exec();

    const now = new Date();
    for (const notification of pending) {
      notification.actionStatus = actionStatus;
      notification.respondedAt = now;
      await notification.save();
      await notificationsService.emitUpdate(String(notification.user), notification, []);
    }
  }
}
