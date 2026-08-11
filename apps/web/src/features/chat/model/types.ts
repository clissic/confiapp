export type ChatChannel = 'BUYER_AGENT' | 'SELLER_AGENT';

export type ChatPeerRole = 'BUYER' | 'SELLER' | 'AGENT';

export interface ChatParticipant {
  id: string;
  name: string;
  identityVerified?: boolean;
  avatar?: string;
  role?: ChatPeerRole;
}

export interface ChatPeer {
  id: string;
  name: string;
  role: ChatPeerRole;
  avatar?: string;
  identityVerified?: boolean;
}

export interface ChatSummary {
  id: string;
  type: string;
  channel?: ChatChannel | string;
  transactionId?: string;
  transactionCode?: string;
  transactionTitle?: string;
  label: string;
  peer?: ChatPeer;
  participants: ChatParticipant[];
  lastMessageAt?: string;
  lastMessagePreview?: string;
  lastMessageSenderId?: string;
  lastMessageSenderName?: string;
  lastMessageReadByPeer?: boolean;
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
  senderIdentityVerified?: boolean;
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

export function peerRoleLabel(role?: ChatPeerRole): string {
  if (role === 'BUYER') return 'Comprador';
  if (role === 'SELLER') return 'Vendedor';
  if (role === 'AGENT') return 'Agente';
  return 'Chat';
}
