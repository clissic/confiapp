import { apiClient } from '@/shared/api/client';

import type { ChatMessage, ChatSummary, MessageAttachment } from '../model/types';

const DEMO_CHATS_KEY = 'confiapp.demo.chats';
const DEMO_MSGS_KEY = 'confiapp.demo.chat-messages';

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
      transactionCode: 'DEMO-001',
      transactionTitle: 'iPhone 14 Pro',
      label: 'Comprador ↔ Agente',
      participants: [
        { id: 'demo-buyer', name: 'Ana Compradora' },
        { id: 'demo-agent', name: 'Vos (Agente)' },
      ],
      lastMessageAt: new Date(Date.now() - 60_000).toISOString(),
      lastMessagePreview: '¿A qué hora nos encontramos?',
      unreadCount: 1,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'demo-chat-seller',
      type: 'TRANSACTION',
      channel: 'SELLER_AGENT',
      transactionCode: 'DEMO-001',
      transactionTitle: 'iPhone 14 Pro',
      label: 'Vendedor ↔ Agente',
      participants: [
        { id: 'demo-seller', name: 'Luis Vendedor' },
        { id: 'demo-agent', name: 'Vos (Agente)' },
      ],
      lastMessageAt: new Date(Date.now() - 120_000).toISOString(),
      lastMessagePreview: 'El equipo está en caja original',
      unreadCount: 0,
      createdAt: new Date().toISOString(),
    },
  ];
  localStorage.setItem(DEMO_CHATS_KEY, JSON.stringify(items));
  return items;
}

function demoMessages(chatId: string): ChatMessage[] {
  const all = readDemoMessages();
  if (all[chatId]?.length) return all[chatId]!;

  const seed: ChatMessage[] =
    chatId === 'demo-chat-buyer'
      ? [
          {
            id: 'm1',
            chatId,
            senderId: 'demo-buyer',
            senderName: 'Ana Compradora',
            type: 'TEXT',
            body: 'Hola, ¿confirmamos el punto de encuentro?',
            attachments: [],
            readBy: ['demo-buyer'],
            createdAt: new Date(Date.now() - 5 * 60_000).toISOString(),
          },
          {
            id: 'm2',
            chatId,
            senderId: 'demo-agent',
            senderName: 'Vos (Agente)',
            type: 'TEXT',
            body: 'Sí, en la esquina de Florida y Córdoba.',
            attachments: [],
            readBy: ['demo-agent', 'demo-buyer'],
            createdAt: new Date(Date.now() - 3 * 60_000).toISOString(),
          },
          {
            id: 'm3',
            chatId,
            senderId: 'demo-buyer',
            senderName: 'Ana Compradora',
            type: 'TEXT',
            body: '¿A qué hora nos encontramos?',
            attachments: [],
            readBy: ['demo-buyer'],
            createdAt: new Date(Date.now() - 60_000).toISOString(),
          },
        ]
      : [
          {
            id: 's1',
            chatId,
            senderId: 'demo-seller',
            senderName: 'Luis Vendedor',
            type: 'TEXT',
            body: 'El equipo está en caja original',
            attachments: [],
            readBy: ['demo-seller', 'demo-agent'],
            createdAt: new Date(Date.now() - 120_000).toISOString(),
          },
        ];

  all[chatId] = seed;
  localStorage.setItem(DEMO_MSGS_KEY, JSON.stringify(all));
  return seed;
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
    all[chatId] = [...(all[chatId] ?? demoMessages(chatId)), msg];
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
