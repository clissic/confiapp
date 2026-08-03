export type ChatChannel = 'BUYER_AGENT' | 'SELLER_AGENT';

export interface ChatParticipant {
  id: string;
  name: string;
}

export interface ChatSummary {
  id: string;
  type: string;
  channel?: ChatChannel | string;
  transactionId?: string;
  transactionCode?: string;
  transactionTitle?: string;
  label: string;
  participants: ChatParticipant[];
  lastMessageAt?: string;
  lastMessagePreview?: string;
  unreadCount: number;
  createdAt: string;
}

export interface MessageAttachment {
  url: string;
  mimeType?: string;
  fileName?: string;
  sizeBytes?: number;
}

export interface ChatMessage {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  type: string;
  body: string;
  attachments: MessageAttachment[];
  readBy: string[];
  createdAt: string;
}

export interface ChatNotifyPayload {
  id: string;
  type: string;
  title: string;
  body: string;
  chatId?: string;
  data?: Record<string, unknown>;
  createdAt: string;
}
