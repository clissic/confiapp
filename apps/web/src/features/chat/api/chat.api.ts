import { apiClient } from '@/shared/api/client';

import type { ChatMessage, ChatSummary, MessageAttachment } from '../model/types';

const DEMO_CHATS_KEY = 'confiapp.demo.chats.v2';
const DEMO_MSGS_KEY = 'confiapp.demo.chat-messages.v2';

function hasApiAuth(): boolean {
  return Boolean(localStorage.getItem('accessToken'));
}

function demoChats(): ChatSummary[] {
  const raw = localStorage.getItem(DEMO_CHATS_KEY);
  if (raw) {
    try {
      return JSON.parse(raw) as ChatSummary[];
    } catch {
      /* fallthrough */
    }
  }
  const items: ChatSummary[] = [
    {
      id: 'demo-chat-buyer',
      type: 'TRANSACTION',
      channel: 'BUYER_AGENT',
      transactionCode: 'CONF-DEMO01',
      transactionTitle: 'iPhone 14 Pro',
      label: 'Ana Compradora - Comprador',
      peer: {
        id: 'demo-buyer',
        name: 'Ana Compradora',
        role: 'BUYER',
      },
      participants: [
        { id: 'demo-buyer', name: 'Ana Compradora', role: 'BUYER' },
        { id: 'demo-agent', name: 'Vos (Agente)', role: 'AGENT' },
      ],
      unreadCount: 0,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'demo-chat-seller',
      type: 'TRANSACTION',
      channel: 'SELLER_AGENT',
      transactionCode: 'CONF-DEMO01',
      transactionTitle: 'iPhone 14 Pro',
      label: 'Luis Vendedor - Vendedor',
      peer: {
        id: 'demo-seller',
        name: 'Luis Vendedor',
        role: 'SELLER',
      },
      participants: [
        { id: 'demo-seller', name: 'Luis Vendedor', role: 'SELLER' },
        { id: 'demo-agent', name: 'Vos (Agente)', role: 'AGENT' },
      ],
      unreadCount: 0,
      createdAt: new Date().toISOString(),
    },
  ];
  localStorage.setItem(DEMO_CHATS_KEY, JSON.stringify(items));
  return items;
}

function demoMessages(chatId: string): ChatMessage[] {
  const all = readDemoMessages();
  if (all[chatId]) return all[chatId]!;

  all[chatId] = [];
  localStorage.setItem(DEMO_MSGS_KEY, JSON.stringify(all));
  return [];
}

function readDemoMessages(): Record<string, ChatMessage[]> {
  try {
    return JSON.parse(localStorage.getItem(DEMO_MSGS_KEY) || '{}') as Record<
      string,
      ChatMessage[]
    >;
  } catch {
    return {};
  }
}

function writeDemoMessages(all: Record<string, ChatMessage[]>): void {
  localStorage.setItem(DEMO_MSGS_KEY, JSON.stringify(all));
}

export async function listChats(): Promise<{ items: ChatSummary[]; source: 'api' | 'demo' }> {
  if (!hasApiAuth()) {
    return { items: demoChats(), source: 'demo' };
  }
  try {
    const { data } = await apiClient.get<{ items: ChatSummary[] }>('/chats');
    return { items: data.items ?? [], source: 'api' };
  } catch {
    return { items: demoChats(), source: 'demo' };
  }
}

export async function listMessages(
  chatId: string,
): Promise<{ items: ChatMessage[]; source: 'api' | 'demo' }> {
  if (!hasApiAuth()) {
    return { items: demoMessages(chatId), source: 'demo' };
  }
  try {
    const { data } = await apiClient.get<{ items: ChatMessage[] }>(
      `/chats/${chatId}/messages`,
      { params: { limit: 80 } },
    );
    return { items: data.items ?? [], source: 'api' };
  } catch {
    return { items: demoMessages(chatId), source: 'demo' };
  }
}

export async function sendMessage(
  chatId: string,
  input: { body?: string; attachments?: MessageAttachment[] },
): Promise<{ message: ChatMessage; source: 'api' | 'demo' }> {
  if (!hasApiAuth()) {
    const msg: ChatMessage = {
      id: `demo-${Date.now()}`,
      chatId,
      senderId: 'demo-agent',
      senderName: 'Vos (Agente)',
      type: input.attachments?.length ? 'ATTACHMENT' : 'TEXT',
      body: input.body?.trim() || (input.attachments?.length ? '[imagen]' : ''),
      attachments: input.attachments ?? [],
      readBy: ['demo-agent'],
      createdAt: new Date().toISOString(),
    };
    const all = readDemoMessages();
    all[chatId] = [...(all[chatId] ?? []), msg];
    writeDemoMessages(all);
    const chats = demoChats().map((c) =>
      c.id === chatId
        ? {
            ...c,
            lastMessageAt: msg.createdAt,
            lastMessagePreview: msg.body.startsWith('[imagen]') ? '🖼 Imagen' : msg.body,
            unreadCount: 0,
          }
        : c,
    );
    localStorage.setItem(DEMO_CHATS_KEY, JSON.stringify(chats));
    return { message: msg, source: 'demo' };
  }

  const { data } = await apiClient.post<ChatMessage>(`/chats/${chatId}/messages`, input);
  return { message: data, source: 'api' };
}

export async function markChatRead(
  chatId: string,
  messageIds?: string[],
): Promise<void> {
  if (!hasApiAuth()) {
    const all = readDemoMessages();
    const list = all[chatId] ?? [];
    all[chatId] = list.map((m) =>
      m.senderId === 'demo-agent' || (messageIds && !messageIds.includes(m.id))
        ? m
        : { ...m, readBy: [...new Set([...m.readBy, 'demo-agent'])] },
    );
    writeDemoMessages(all);
    const chats = demoChats().map((c) =>
      c.id === chatId ? { ...c, unreadCount: 0 } : c,
    );
    localStorage.setItem(DEMO_CHATS_KEY, JSON.stringify(chats));
    return;
  }
  await apiClient.post(`/chats/${chatId}/read`, { messageIds });
}
