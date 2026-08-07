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
import type { HydratedDocument } from 'mongoose';
import { Types } from 'mongoose';

import { NotificationModel, ProductModel, UserModel } from '../../database/models';
import { env } from '../../shared/config/env';
import { AppError, ForbiddenError, NotFoundError, ValidationError } from '../../shared/errors/app-error';
import { generateOpaqueToken, hashToken } from '../../utils/crypto-tokens';
import { notificationsService } from '../notifications/service';

import { diffBuyerProposalVsSellerConfirm } from './buyer-proposal-diff';
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
    meetingLocation: legacyMeeting,
    party: {
      ...(partyBuyer ? { buyer: partyBuyer } : {}),
      ...(partySeller ? { seller: partySeller } : {}),
    },
    returnInstructions,
    viewerRole: viewerRole ?? undefined,
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
        initiatedBy: TransactionInitiator.BUYER,
        amountCents,
        currency: (input.currency ?? 'UYU').toUpperCase(),
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
        initiatedBy: TransactionInitiator.SELLER,
        amountCents,
        currency,
        productId: String(product._id),
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
    return toDto(tx, {
      product: await loadProductDto(tx.product),
      viewerUserId: userId,
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
    const nextChecklist = normalized.map((item) => {
      if (item.id !== itemId) {
        return {
          id: item.id,
          text: item.text,
          done: item.done,
          doneAt: item.doneAt ? new Date(item.doneAt) : undefined,
        };
      }
      return {
        id: item.id,
        text: item.text,
        done,
        doneAt: done ? now : undefined,
        doneBy: done ? new Types.ObjectId(userId) : undefined,
      };
    });

    tx.party[resolvedSide] = {
      ...currentSide,
      checklist: nextChecklist,
    };
    tx.markModified('party');

    // Mantener legacy alineado al lado del iniciador si aplica.
    const initiatorSide =
      getInitiatedBy(tx) === TransactionInitiator.SELLER ? 'seller' : 'buyer';
    if (resolvedSide === initiatorSide) {
      tx.conditions.checklist = nextChecklist as typeof tx.conditions.checklist;
    }

    await tx.save();
    return toDto(tx, {
      product: await loadProductDto(tx.product),
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
      metadata: { note: 'invite_refreshed' },
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
    const updated = await this.repository.acceptPurchase(tx, userId, partyBuyer, deadline);

    await notificationsService.notify({
      userId: String(updated.createdBy),
      type: NotificationType.TRANSACTION_UPDATE,
      title: 'El comprador aceptó la compra',
      body: `La operación ${updated.code} quedó aceptada. Pendiente de fondeo.`,
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
      },
      {
        title: input.title,
        description: input.description,
        amountCents,
        currency,
        condition: input.condition,
        category,
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
        body: `El vendedor confirmó la venta en ${updated.code}. Pendiente de fondeo.`,
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
        body: `La operación ${updated.code} quedó aceptada. Pendiente de fondeo.`,
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
