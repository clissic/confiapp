import {
  ChatChannel,
  ChatType,
  MessageType,
  NotificationChannel,
  NotificationType,
  ParticipantRole,
  ParticipantStatus,
  TransactionInitiator,
  type IChat,
  type IMessage,
  type ITransaction,
  type MessageAttachment,
} from '@confiapp/database';
import { Types, type HydratedDocument } from 'mongoose';

import { ChatModel, MessageModel, TransactionModel, UserModel } from '../../database/models';
import { ForbiddenError, NotFoundError, ValidationError } from '../../shared/errors/app-error';
import {
  publishRealtime,
  publishRealtimeToUser,
} from '../../infrastructure/realtime/realtime-bus';
import { chatRoom } from '../../infrastructure/realtime/rooms';
import { notificationsService } from '../notifications/service';

export type ChatDocument = HydratedDocument<IChat>;
export type MessageDocument = HydratedDocument<IMessage>;
export type TransactionDocument = HydratedDocument<ITransaction>;

export interface ChatParticipantDto {
  id: string;
  name: string;
}

export interface ChatDto {
  id: string;
  type: string;
  channel?: string;
  transactionId?: string;
  transactionCode?: string;
  transactionTitle?: string;
  label: string;
  participants: ChatParticipantDto[];
  lastMessageAt?: string;
  lastMessagePreview?: string;
  unreadCount: number;
  createdAt: string;
}

export interface MessageDto {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  senderIdentityVerified?: boolean;
  type: string;
  body: string;
  attachments: MessageAttachment[];
  readBy: string[];
  createdAt: string;
}

function partyRoles(initiatedBy: TransactionInitiator): {
  buyerRole: 'creator' | 'counterparty';
  sellerRole: 'creator' | 'counterparty';
} {
  if (initiatedBy === TransactionInitiator.SELLER) {
    return { buyerRole: 'counterparty', sellerRole: 'creator' };
  }
  return { buyerRole: 'creator', sellerRole: 'counterparty' };
}

function resolveParties(tx: {
  createdBy: Types.ObjectId;
  initiatedBy?: TransactionInitiator;
  participants: Array<{ user: Types.ObjectId; role: ParticipantRole; status: ParticipantStatus }>;
}): { buyerId?: string; sellerId?: string; agentId?: string } {
  const roles = partyRoles(tx.initiatedBy ?? TransactionInitiator.BUYER);
  const counter = tx.participants.find(
    (p) =>
      p.role === ParticipantRole.COUNTERPARTY &&
      (p.status === ParticipantStatus.ACCEPTED || p.status === ParticipantStatus.INVITED),
  );
  const agent = tx.participants.find(
    (p) =>
      p.role === ParticipantRole.INTERMEDIARY && p.status === ParticipantStatus.ACCEPTED,
  );
  const creatorId = String(tx.createdBy);
  const counterId = counter ? String(counter.user) : undefined;
  return {
    buyerId: roles.buyerRole === 'creator' ? creatorId : counterId,
    sellerId: roles.sellerRole === 'creator' ? creatorId : counterId,
    agentId: agent ? String(agent.user) : undefined,
  };
}

function channelLabel(channel?: ChatChannel | string): string {
  if (channel === ChatChannel.BUYER_AGENT) return 'Comprador ↔ Agente';
  if (channel === ChatChannel.SELLER_AGENT) return 'Vendedor ↔ Agente';
  return 'Chat';
}

export class ChatsService {
  /** Crea (idempotente) los dos chats Buyer↔Agente y Seller↔Agente. */
  async ensureTransactionChats(transactionId: string): Promise<ChatDocument[]> {
    const tx = await TransactionModel.findById(transactionId).exec();
    if (!tx) throw new NotFoundError('Operación no encontrada');

    const { buyerId, sellerId, agentId } = resolveParties(tx);
    if (!agentId) {
      throw new ValidationError('La operación aún no tiene agente aceptado');
    }

    const created: ChatDocument[] = [];

    if (buyerId && buyerId !== agentId) {
      created.push(
        await this.upsertChannelChat({
          transactionId: String(tx._id),
          channel: ChatChannel.BUYER_AGENT,
          participants: [buyerId, agentId],
          createdBy: agentId,
        }),
      );
    }

    if (sellerId && sellerId !== agentId) {
      created.push(
        await this.upsertChannelChat({
          transactionId: String(tx._id),
          channel: ChatChannel.SELLER_AGENT,
          participants: [sellerId, agentId],
          createdBy: agentId,
        }),
      );
    }

    return created;
  }

  private async upsertChannelChat(input: {
    transactionId: string;
    channel: ChatChannel;
    participants: string[];
    createdBy: string;
  }): Promise<ChatDocument> {
    const existing = await ChatModel.findOne({
      transaction: input.transactionId,
      channel: input.channel,
      deletedAt: null,
    }).exec();
    if (existing) return existing;

    try {
      const created = await ChatModel.create({
        type: ChatType.TRANSACTION,
        channel: input.channel,
        transaction: new Types.ObjectId(input.transactionId),
        participants: input.participants.map((id) => new Types.ObjectId(id)),
        createdBy: new Types.ObjectId(input.createdBy),
      });
      const { auditService, AuditAction, AuditOutcome } = await import('../audit');
      auditService.track({
        actor: input.createdBy,
        action: AuditAction.CHAT_CREATED,
        entityType: 'Chat',
        entityId: String(created._id),
        outcome: AuditOutcome.SUCCESS,
        correlationId: input.transactionId,
        metadata: {
          channel: input.channel,
          transactionId: input.transactionId,
          participants: input.participants,
        },
      });
      return created;
    } catch (error: unknown) {
      // Carrera: índice único — re-leer.
      const again = await ChatModel.findOne({
        transaction: input.transactionId,
        channel: input.channel,
        deletedAt: null,
      }).exec();
      if (again) return again;
      throw error;
    }
  }

  async listMine(userId: string): Promise<ChatDto[]> {
    const chats = await ChatModel.find({
      participants: userId,
      deletedAt: null,
    })
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .limit(100)
      .lean()
      .exec();

    if (chats.length === 0) return [];

    const userIds = [...new Set(chats.flatMap((c) => c.participants.map((p) => String(p))))];
    const txIds = chats
      .map((c) => c.transaction)
      .filter(Boolean)
      .map((id) => String(id));

    const [users, transactions, unreadAgg] = await Promise.all([
      UserModel.find({ _id: { $in: userIds } })
        .select('fullName displayName kyc.status verification.identity.status')
        .lean()
        .exec(),
      TransactionModel.find({ _id: { $in: txIds } })
        .select('code title')
        .lean()
        .exec(),
      MessageModel.aggregate<{ _id: Types.ObjectId; count: number }>([
        {
          $match: {
            chat: { $in: chats.map((c) => c._id) },
            deletedAt: null,
            sender: { $ne: new Types.ObjectId(userId) },
            readBy: { $ne: new Types.ObjectId(userId) },
          },
        },
        { $group: { _id: '$chat', count: { $sum: 1 } } },
      ]),
    ]);

    const userMap = new Map(
      users.map((u) => {
        const status = u.kyc?.status ?? u.verification?.identity?.status;
        return [
          String(u._id),
          {
            name: u.displayName || u.fullName || 'Usuario',
            identityVerified: status === 'VERIFIED',
          },
        ] as const;
      }),
    );
    const txMap = new Map(
      transactions.map((t) => [String(t._id), { code: t.code, title: t.title }]),
    );
    const unreadMap = new Map(unreadAgg.map((row) => [String(row._id), row.count]));

    return chats.map((chat) => {
      const tx = chat.transaction ? txMap.get(String(chat.transaction)) : undefined;
      return {
        id: String(chat._id),
        type: chat.type,
        channel: chat.channel,
        transactionId: chat.transaction ? String(chat.transaction) : undefined,
        transactionCode: tx?.code,
        transactionTitle: tx?.title,
        label: channelLabel(chat.channel),
        participants: chat.participants.map((p) => {
          const info = userMap.get(String(p));
          return {
            id: String(p),
            name: info?.name || 'Usuario',
            identityVerified: Boolean(info?.identityVerified),
          };
        }),
        lastMessageAt: chat.lastMessageAt?.toISOString(),
        lastMessagePreview: chat.lastMessagePreview,
        unreadCount: unreadMap.get(String(chat._id)) ?? 0,
        createdAt: chat.createdAt.toISOString(),
      };
    });
  }

  async getChatForUser(userId: string, chatId: string): Promise<ChatDocument> {
    if (!Types.ObjectId.isValid(chatId)) throw new NotFoundError('Chat no encontrado');
    const chat = await ChatModel.findOne({ _id: chatId, deletedAt: null }).exec();
    if (!chat) throw new NotFoundError('Chat no encontrado');
    if (!chat.participants.some((p) => String(p) === userId)) {
      throw new ForbiddenError('No tenés acceso a este chat');
    }
    return chat;
  }

  async listMessages(
    userId: string,
    chatId: string,
    opts: { before?: string; limit?: number } = {},
  ): Promise<MessageDto[]> {
    await this.getChatForUser(userId, chatId);
    const limit = Math.min(opts.limit ?? 50, 100);
    const filter: Record<string, unknown> = {
      chat: chatId,
      deletedAt: null,
    };
    if (opts.before && Types.ObjectId.isValid(opts.before)) {
      const beforeMsg = await MessageModel.findById(opts.before).select('createdAt').lean().exec();
      if (beforeMsg) {
        filter.createdAt = { $lt: beforeMsg.createdAt };
      }
    }

    const messages = await MessageModel.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()
      .exec();

    const senderIds = [...new Set(messages.map((m) => String(m.sender)))];
    const senders = await UserModel.find({ _id: { $in: senderIds } })
      .select('fullName displayName kyc.status verification.identity.status')
      .lean()
      .exec();
    const senderMap = new Map(
      senders.map((u) => {
        const status = u.kyc?.status ?? u.verification?.identity?.status;
        return [
          String(u._id),
          {
            name: u.displayName || u.fullName || 'Usuario',
            identityVerified: status === 'VERIFIED',
          },
        ] as const;
      }),
    );

    return messages
      .map((m) => {
        const info = senderMap.get(String(m.sender));
        return this.toMessageDto(
          m,
          info?.name || 'Usuario',
          Boolean(info?.identityVerified),
        );
      })
      .reverse();
  }

  async sendMessage(
    userId: string,
    chatId: string,
    input: { body?: string; attachments?: MessageAttachment[] },
  ): Promise<MessageDto> {
    const chat = await this.getChatForUser(userId, chatId);
    const attachments = input.attachments ?? [];
    const body = (input.body ?? '').trim();

    if (!body && attachments.length === 0) {
      throw new ValidationError('El mensaje no puede estar vacío');
    }
    if (attachments.length > 10) {
      throw new ValidationError('Máximo 10 adjuntos por mensaje');
    }
    for (const att of attachments) {
      if (!att.url || (!/^https?:\/\//i.test(att.url) && !att.url.startsWith('data:image/'))) {
        throw new ValidationError('Adjunto inválido: se espera URL http(s) o data:image');
      }
    }

    const type =
      attachments.length > 0 && !body
        ? MessageType.ATTACHMENT
        : attachments.length > 0
          ? MessageType.ATTACHMENT
          : MessageType.TEXT;

    const preview =
      body ||
      (attachments.length > 0 ? `🖼 ${attachments[0]?.fileName || 'Imagen'}` : '');

    const message = await MessageModel.create({
      chat: chat._id,
      sender: new Types.ObjectId(userId),
      type,
      body: body || (attachments.length > 0 ? '[imagen]' : ''),
      attachments,
      readBy: [new Types.ObjectId(userId)],
    });

    chat.lastMessageAt = message.createdAt;
    chat.lastMessagePreview = preview.slice(0, 280);
    await chat.save();

    const sender = await UserModel.findById(userId)
      .select('fullName displayName kyc.status verification.identity.status')
      .lean()
      .exec();
    const senderName = sender?.displayName || sender?.fullName || 'Usuario';
    const senderIdentityVerified =
      (sender?.kyc?.status ?? sender?.verification?.identity?.status) === 'VERIFIED';
    const dto = this.toMessageDto(message.toObject(), senderName, senderIdentityVerified);

    publishRealtime(chatRoom(String(chat._id)), 'message:new', dto);

    const recipients = chat.participants
      .map((p) => String(p))
      .filter((id) => id !== userId);

    await Promise.all(
      recipients.map((recipientId) =>
        this.notifyNewMessage({
          recipientId,
          chatId: String(chat._id),
          channel: chat.channel,
          senderName,
          preview: chat.lastMessagePreview || preview,
          messageId: String(message._id),
          transactionId: chat.transaction ? String(chat.transaction) : undefined,
        }),
      ),
    );

    const { auditService, AuditAction, AuditOutcome } = await import('../audit');
    auditService.track({
      actor: userId,
      action: AuditAction.MESSAGE_SENT,
      entityType: 'Message',
      entityId: String(message._id),
      outcome: AuditOutcome.SUCCESS,
      correlationId: chat.transaction ? String(chat.transaction) : String(chat._id),
      metadata: {
        chatId: String(chat._id),
        channel: chat.channel,
        type,
        hasAttachments: attachments.length > 0,
        attachmentCount: attachments.length,
      },
    });

    return dto;
  }

  async markRead(
    userId: string,
    chatId: string,
    messageIds?: string[],
  ): Promise<{ chatId: string; messageIds: string[]; readBy: string }> {
    await this.getChatForUser(userId, chatId);

    const filter: Record<string, unknown> = {
      chat: chatId,
      deletedAt: null,
      sender: { $ne: userId },
      readBy: { $ne: userId },
    };
    if (messageIds?.length) {
      filter._id = { $in: messageIds.filter((id) => Types.ObjectId.isValid(id)) };
    }

    const messages = await MessageModel.find(filter).select('_id').lean().exec();
    const ids = messages.map((m) => m._id);
    if (ids.length > 0) {
      await MessageModel.updateMany(
        { _id: { $in: ids } },
        { $addToSet: { readBy: new Types.ObjectId(userId) } },
      ).exec();
    }

    const payload = {
      chatId,
      messageIds: ids.map((id) => String(id)),
      readBy: userId,
    };
    publishRealtime(chatRoom(chatId), 'message:read', payload);
    return payload;
  }

  emitTyping(userId: string, chatId: string, isTyping: boolean): void {
    publishRealtime(chatRoom(chatId), 'typing:update', {
      chatId,
      userId,
      isTyping,
    });
  }

  private async notifyNewMessage(input: {
    recipientId: string;
    chatId: string;
    channel?: ChatChannel;
    senderName: string;
    preview: string;
    messageId: string;
    transactionId?: string;
  }): Promise<void> {
    const title = `Nuevo mensaje · ${channelLabel(input.channel)}`;
    const body = `${input.senderName}: ${input.preview}`;

    const doc = await notificationsService.notify({
      userId: input.recipientId,
      type: NotificationType.MESSAGE,
      title,
      body,
      data: {
        chatId: input.chatId,
        messageId: input.messageId,
        channel: input.channel,
        transactionId: input.transactionId,
        href: `/mensajes?chat=${input.chatId}`,
      },
      entityType: 'Chat',
      entityId: input.chatId,
      channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
    });

    if (!doc) return;

    publishRealtimeToUser(input.recipientId, 'chat:notify', {
      id: String(doc._id),
      type: doc.type,
      title: doc.title,
      body: doc.body,
      data: doc.data,
      entityType: doc.entityType,
      entityId: doc.entityId ? String(doc.entityId) : undefined,
      createdAt: doc.createdAt.toISOString(),
      chatId: input.chatId,
    });
  }

  private toMessageDto(
    m: {
      _id: Types.ObjectId;
      chat: Types.ObjectId;
      sender: Types.ObjectId;
      type: string;
      body: string;
      attachments?: MessageAttachment[];
      readBy?: Types.ObjectId[];
      createdAt: Date;
    },
    senderName: string,
    senderIdentityVerified = false,
  ): MessageDto {
    return {
      id: String(m._id),
      chatId: String(m.chat),
      senderId: String(m.sender),
      senderName,
      senderIdentityVerified,
      type: m.type,
      body: m.body,
      attachments: m.attachments ?? [],
      readBy: (m.readBy ?? []).map((id) => String(id)),
      createdAt: m.createdAt.toISOString(),
    };
  }
}
