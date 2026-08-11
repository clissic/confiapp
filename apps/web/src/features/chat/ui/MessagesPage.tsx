import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Alert, Badge, Button, Form, Spinner } from 'react-bootstrap';
import { motion } from 'framer-motion';
import { ArrowLeft, CheckCheck, Handshake, ImagePlus, MessageSquare, Send, ShoppingBag, Store } from 'lucide-react';

import { formatTime } from '@/shared/lib/money';
import { VerifiedName } from '@/shared/ui/VerifiedName';
import {
  useChatMessages,
  useChats,
  useSendChatMessage,
} from '../hooks/useChat';
import { emitMarkRead, emitTyping, useChatRealtime } from '../hooks/useChatRealtime';
import { markChatRead } from '../api/chat.api';
import type { ChatMessage, ChatPeerRole, ChatSummary } from '../model/types';
import { peerRoleLabel } from '../model/types';
import '../styles/chat.css';

const PHONE_CHAT_MQ = '(max-width: 767.98px)';

type ConversationRoleFilter = 'ALL' | ChatPeerRole;

const ROLE_FILTERS: Array<{
  id: ConversationRoleFilter;
  label: string;
  Icon: typeof MessageSquare;
}> = [
  { id: 'ALL', label: 'Todos los chats', Icon: MessageSquare },
  { id: 'AGENT', label: 'Agentes', Icon: Handshake },
  { id: 'BUYER', label: 'Compradores', Icon: ShoppingBag },
  { id: 'SELLER', label: 'Vendedores', Icon: Store },
];

function roleFilterLegend(filter: ConversationRoleFilter): string {
  return ROLE_FILTERS.find((item) => item.id === filter)?.label ?? 'Todos los chats';
}

/** Solo teléfono: lista ↔ chat a pantalla completa. Tablet/desktop: dos columnas. */
function usePhoneChatLayout(): boolean {
  const [phone, setPhone] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(PHONE_CHAT_MQ).matches : false,
  );

  useEffect(() => {
    const mq = window.matchMedia(PHONE_CHAT_MQ);
    const sync = () => setPhone(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  return phone;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
    reader.readAsDataURL(file);
  });
}

function initialsFromLabel(label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
}

function ChatAvatar({
  name,
  avatar,
  className,
}: {
  name: string;
  avatar?: string;
  className?: string;
}) {
  return (
    <span className={`ca-chat-avatar ${className ?? ''}`.trim()} aria-hidden>
      {avatar ? (
        <img src={avatar} alt="" className="ca-chat-avatar__img" />
      ) : (
        <span className="ca-chat-avatar__placeholder">{initialsFromLabel(name)}</span>
      )}
    </span>
  );
}

function PeerRoleIcon({
  role,
  size = 15,
}: {
  role?: ChatPeerRole;
  size?: number;
}) {
  if (!role) return null;
  const label = peerRoleLabel(role);
  const Icon =
    role === 'BUYER' ? ShoppingBag : role === 'SELLER' ? Store : role === 'AGENT' ? Handshake : null;
  if (!Icon) return null;
  return (
    <span className="ca-chat-role-icon" title={label} aria-label={label} role="img">
      <Icon size={size} strokeWidth={1.85} aria-hidden />
    </span>
  );
}

function ConversationRoleFilters({
  value,
  onChange,
}: {
  value: ConversationRoleFilter;
  onChange: (next: ConversationRoleFilter) => void;
}) {
  return (
    <div className="ca-chat-role-filters" role="group" aria-label="Filtrar conversaciones">
      {ROLE_FILTERS.map(({ id, label, Icon }) => {
        const active = value === id;
        return (
          <button
            key={id}
            type="button"
            className={`ca-chat-role-filter${active ? ' ca-chat-role-filter--active' : ''}`}
            aria-label={label}
            aria-pressed={active}
            title={label}
            onClick={() => onChange(id)}
          >
            <Icon size={14} strokeWidth={1.85} aria-hidden />
          </button>
        );
      })}
    </div>
  );
}

function PeerTitle({
  name,
  role,
  className,
}: {
  name: string;
  role?: ChatPeerRole;
  className?: string;
}) {
  return (
    <span className={`ca-chat-peer-title ${className ?? ''}`.trim()}>
      <span className="ca-chat-peer-title__name">{name}</span>
      <PeerRoleIcon role={role} />
    </span>
  );
}

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || fullName;
}

function previewBody(preview?: string): string {
  if (!preview) return 'Sin mensajes';
  if (preview.startsWith('[imagen]')) return '🖼 Imagen';
  return preview;
}

function ConversationPreview({ chat, me }: { chat: ChatSummary; me: string }) {
  const body = previewBody(chat.lastMessagePreview);
  const fromMe = Boolean(chat.lastMessageSenderId && chat.lastMessageSenderId === me);

  if (!chat.lastMessagePreview && !chat.lastMessageSenderId) {
    return <span className="ca-chat-thread__preview">Sin mensajes</span>;
  }

  if (fromMe) {
    return (
      <span className="ca-chat-thread__preview ca-chat-thread__preview--mine">
        <CheckCheck
          size={14}
          className={
            chat.lastMessageReadByPeer
              ? 'ca-chat-thread__ticks ca-chat-thread__ticks--read'
              : 'ca-chat-thread__ticks'
          }
          aria-hidden
        />
        <span>{body}</span>
      </span>
    );
  }

  const sender = chat.lastMessageSenderName || chat.peer?.name || 'Usuario';
  return (
    <span className="ca-chat-thread__preview">
      {firstName(sender)}: {body}
    </span>
  );
}

export function MessagesPage() {
  const compact = usePhoneChatLayout();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: chatsData, isFetching: loadingChats } = useChats();
  const chats = chatsData?.items ?? [];
  const chatFromUrl = searchParams.get('chat');
  const selectedId = chatFromUrl || (!compact ? chats[0]?.id : null) || null;
  const showRoom = Boolean(selectedId);

  const { data: messagesData, isFetching: loadingMessages } = useChatMessages(selectedId);
  const messages = messagesData?.items ?? [];
  const send = useSendChatMessage(selectedId);
  const { typingUserId, connectionState, me } = useChatRealtime(selectedId);

  const [roleFilter, setRoleFilter] = useState<ConversationRoleFilter>('ALL');
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pendingImage, setPendingImage] = useState<{
    url: string;
    fileName: string;
    mimeType: string;
  } | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const markedRef = useRef<Set<string>>(new Set());
  const prevSelectedRef = useRef<string | null>(null);

  const selected = useMemo(
    () => chats.find((c) => c.id === selectedId) ?? null,
    [chats, selectedId],
  );

  const filteredChats = useMemo(() => {
    if (roleFilter === 'ALL') return chats;
    return chats.filter((chat) => chat.peer?.role === roleFilter);
  }, [chats, roleFilter]);

  const scrollMessagesToEnd = (behavior: ScrollBehavior = 'auto') => {
    const el = messagesRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  };

  useEffect(() => {
    const openedNew = prevSelectedRef.current !== selectedId;
    prevSelectedRef.current = selectedId;
    const frame = window.requestAnimationFrame(() => {
      scrollMessagesToEnd(openedNew ? 'auto' : 'smooth');
      // Segunda pasada por si el layout aún no midió la altura fija
      window.requestAnimationFrame(() => {
        scrollMessagesToEnd(openedNew ? 'auto' : 'smooth');
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [selectedId, messages.length, typingUserId, loadingMessages]);

  useEffect(() => {
    markedRef.current = new Set();
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId || messages.length === 0) return;
    const unread = messages.filter(
      (m) =>
        m.senderId !== me &&
        !m.readBy.includes(me) &&
        !markedRef.current.has(m.id),
    );
    if (unread.length === 0) return;
    const ids = unread.map((m) => m.id);
    ids.forEach((id) => markedRef.current.add(id));
    emitMarkRead(selectedId, ids);
    void markChatRead(selectedId, ids).catch(() => {
      ids.forEach((id) => markedRef.current.delete(id));
    });
  }, [selectedId, messages, me]);

  const selectChat = (id: string) => {
    setSearchParams({ chat: id });
    setDraft('');
    setPendingImage(null);
    setError(null);
  };

  const backToConversations = () => {
    setSearchParams({});
    setDraft('');
    setPendingImage(null);
    setError(null);
  };

  const onDraftChange = (value: string) => {
    setDraft(value);
    if (!selectedId) return;
    emitTyping(selectedId, true);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      if (selectedId) emitTyping(selectedId, false);
    }, 1200);
  };

  const onPickImage = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Solo se permiten imágenes');
      return;
    }
    if (file.size > 4_500_000) {
      setError('La imagen no puede superar ~4.5 MB');
      return;
    }
    try {
      const url = await readFileAsDataUrl(file);
      setPendingImage({ url, fileName: file.name, mimeType: file.type });
      setError(null);
    } catch {
      setError('No se pudo cargar la imagen');
    }
  };

  const onSend = async () => {
    if (!selectedId) return;
    const body = draft.trim();
    if (!body && !pendingImage) return;
    setError(null);
    emitTyping(selectedId, false);
    try {
      await send.mutateAsync({
        body: body || undefined,
        attachments: pendingImage
          ? [
              {
                url: pendingImage.url,
                fileName: pendingImage.fileName,
                mimeType: pendingImage.mimeType,
              },
            ]
          : undefined,
      });
      setDraft('');
      setPendingImage(null);
    } catch {
      setError('No se pudo enviar el mensaje');
    }
  };

  const connectionOnline = connectionState === 'online';
  const connectionLabel =
    connectionState === 'online'
      ? 'En línea'
      : connectionState === 'reconnecting'
        ? 'Reconectando…'
        : connectionState === 'connecting'
          ? 'Conectando…'
          : 'Sin conexión';

  const threadsList =
    filteredChats.length === 0 ? (
      <div className="ca-chat__empty">
        <MessageSquare size={28} strokeWidth={1.75} />
        <p>
          {chats.length === 0
            ? 'No hay chats aún. Se crean al aceptar un agente.'
            : 'No hay conversaciones con este filtro.'}
        </p>
      </div>
    ) : (
      <ul className="ca-chat-threads">
        {filteredChats.map((chat) => (
          <ConversationItem
            key={chat.id}
            chat={chat}
            active={chat.id === selectedId}
            me={me ?? ''}
            onSelect={selectChat}
          />
        ))}
      </ul>
    );

  const roomBody = (
    <ChatRoom
      selected={selected}
      messages={messages}
      me={me ?? ''}
      loadingMessages={loadingMessages}
      typingUserId={typingUserId}
      draft={draft}
      pendingImage={pendingImage}
      sendPending={send.isPending}
      bottomRef={bottomRef}
      messagesRef={messagesRef}
      fileRef={fileRef}
      onDraftChange={onDraftChange}
      onPickImage={onPickImage}
      onClearImage={() => setPendingImage(null)}
      onSend={() => void onSend()}
      onTypingBlur={() => selectedId && emitTyping(selectedId, false)}
      showDesktopHead={!compact}
    />
  );

  return (
    <div
      className={[
        'ca-chat',
        compact ? 'ca-chat--compact' : 'ca-chat--desktop',
        compact && showRoom ? 'ca-chat--room' : '',
        compact && !showRoom ? 'ca-chat--list' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Compacto · lista: barra mínima */}
      {compact && !showRoom ? (
        <header className="ca-chat-bar ca-chat-bar--list">
          <div className="ca-chat-bar__text">
            <h1 className="ca-chat-bar__title">Conversaciones</h1>
            <p className="ca-chat-bar__sub">
              {loadingChats ? 'Cargando…' : roleFilterLegend(roleFilter)}
            </p>
          </div>
          <div className="ca-chat-bar__trailing">
            <ConversationRoleFilters value={roleFilter} onChange={setRoleFilter} />
            <span
              className={`ca-chat-bar__status${connectionOnline ? ' ca-chat-bar__status--on' : ''}`}
              title={connectionLabel}
            >
              {connectionLabel}
            </span>
          </div>
        </header>
      ) : null}

      {/* Compacto · chat: barra estilo WhatsApp con volver */}
      {compact && showRoom ? (
        <header className="ca-chat-bar ca-chat-bar--room">
          <button
            type="button"
            className="ca-chat-bar__back"
            aria-label="Volver a conversaciones"
            onClick={backToConversations}
          >
            <ArrowLeft size={22} strokeWidth={2.25} aria-hidden />
          </button>
          <ChatAvatar
            name={selected?.peer?.name ?? selected?.label ?? 'Chat'}
            avatar={selected?.peer?.avatar}
            className="ca-chat-bar__avatar"
          />
          <div className="ca-chat-bar__text">
            <h1 className="ca-chat-bar__title">
              {selected?.peer ? (
                <PeerTitle name={selected.peer.name} role={selected.peer.role} />
              ) : (
                (selected?.label ?? 'Chat')
              )}
            </h1>
            <p className="ca-chat-bar__sub">
              {typingUserId ? (
                'Escribiendo…'
              ) : selected?.transactionCode ? (
                <Link
                  className="ca-chat-bar__tx-link"
                  to={`/operaciones/${encodeURIComponent(selected.transactionCode)}`}
                >
                  {selected.transactionCode}
                </Link>
              ) : (
                connectionLabel
              )}
            </p>
          </div>
          {loadingMessages ? <Spinner size="sm" animation="border" /> : null}
        </header>
      ) : null}

      {error ? (
        <Alert variant="danger" className="ca-chat__alert">
          {error}
        </Alert>
      ) : null}

      {compact ? (
        !showRoom ? (
          <section className="ca-chat__list ca-chat__list--stack" aria-label="Conversaciones">
            {threadsList}
          </section>
        ) : (
          <section className="ca-chat__room ca-chat__room--stack" aria-label="Chat">
            {roomBody}
          </section>
        )
      ) : (
        <div className="ca-chat__layout">
          <header className="ca-chat-bar ca-chat-bar--desktop">
            <div className="ca-chat-bar__text">
              <h1 className="ca-chat-bar__title">Mensajes</h1>
              <p className="ca-chat-bar__sub">Chats de operación en tiempo real</p>
            </div>
            <span
              className={`ca-chat-bar__status${connectionOnline ? ' ca-chat-bar__status--on' : ''}`}
            >
              {connectionLabel}
            </span>
          </header>
          <aside className="ca-chat__list" aria-label="Conversaciones">
            <div className="ca-chat__list-head">
              <div className="ca-chat__list-head-text">
                <strong>Conversaciones</strong>
                <span className="ca-chat__list-head-sub">
                  {loadingChats ? 'Cargando…' : roleFilterLegend(roleFilter)}
                </span>
              </div>
              <div className="ca-chat__list-head-actions">
                <ConversationRoleFilters value={roleFilter} onChange={setRoleFilter} />
                {loadingChats ? <Spinner size="sm" animation="border" /> : null}
              </div>
            </div>
            {threadsList}
          </aside>
          <section className="ca-chat__room" aria-label="Chat">
            {roomBody}
          </section>
        </div>
      )}
    </div>
  );
}

function ConversationItem({
  chat,
  active,
  me,
  onSelect,
}: {
  chat: ChatSummary;
  active: boolean;
  me: string;
  onSelect: (id: string) => void;
}) {
  const peerName = chat.peer?.name ?? chat.label;

  return (
    <li>
      <button
        type="button"
        className={`ca-chat-thread${active ? ' ca-chat-thread--active' : ''}`}
        onClick={() => onSelect(chat.id)}
      >
        <ChatAvatar name={peerName} avatar={chat.peer?.avatar} />
        <span className="ca-chat-thread__main">
          <span className="ca-chat-thread__row">
            <strong className="ca-chat-thread__name">
              {chat.peer ? (
                <PeerTitle name={peerName} role={chat.peer.role} />
              ) : (
                chat.label
              )}
            </strong>
            {chat.lastMessageAt ? (
              <time className="ca-chat-thread__time" dateTime={chat.lastMessageAt}>
                {formatTime(chat.lastMessageAt)}
              </time>
            ) : null}
          </span>
          {chat.transactionCode ? (
            <span className="ca-chat-thread__code">{chat.transactionCode}</span>
          ) : null}
          <span className="ca-chat-thread__row">
            <ConversationPreview chat={chat} me={me} />
            {chat.unreadCount > 0 ? (
              <Badge bg="success" pill className="ca-chat-thread__unread">
                {chat.unreadCount}
              </Badge>
            ) : null}
          </span>
        </span>
      </button>
    </li>
  );
}

function ChatRoom({
  selected,
  messages,
  me,
  loadingMessages,
  typingUserId,
  draft,
  pendingImage,
  sendPending,
  bottomRef,
  messagesRef,
  fileRef,
  onDraftChange,
  onPickImage,
  onClearImage,
  onSend,
  onTypingBlur,
  showDesktopHead,
}: {
  selected: ChatSummary | null;
  messages: ChatMessage[];
  me: string;
  loadingMessages: boolean;
  typingUserId: string | null;
  draft: string;
  pendingImage: { url: string; fileName: string; mimeType: string } | null;
  sendPending: boolean;
  bottomRef: React.RefObject<HTMLDivElement | null>;
  messagesRef: React.RefObject<HTMLDivElement | null>;
  fileRef: React.RefObject<HTMLInputElement | null>;
  onDraftChange: (value: string) => void;
  onPickImage: (file: File | null) => void;
  onClearImage: () => void;
  onSend: () => void;
  onTypingBlur: () => void;
  showDesktopHead: boolean;
}) {
  if (!selected) {
    return (
      <div className="ca-chat__empty ca-chat__empty--room">
        <MessageSquare size={36} strokeWidth={1.5} />
        <p>Elegí una conversación</p>
      </div>
    );
  }

  return (
    <>
      {showDesktopHead ? (
        <div className="ca-chat__room-head">
          <ChatAvatar
            name={selected.peer?.name ?? selected.label}
            avatar={selected.peer?.avatar}
          />
          <div className="ca-chat__room-head-text">
            <strong>
              {selected.peer ? (
                <PeerTitle name={selected.peer.name} role={selected.peer.role} />
              ) : (
                selected.label
              )}
            </strong>
            <span className="ca-chat__room-head-meta">
              {selected.transactionCode ? (
                <Link
                  className="ca-chat-bar__tx-link"
                  to={`/operaciones/${encodeURIComponent(selected.transactionCode)}`}
                >
                  {selected.transactionCode}
                </Link>
              ) : (
                'Operación'
              )}
            </span>
          </div>
          {loadingMessages ? <Spinner size="sm" animation="border" /> : null}
        </div>
      ) : null}

      <div className="ca-chat-messages" ref={messagesRef}>
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} mine={msg.senderId === me} />
        ))}
        {typingUserId ? (
          <motion.div
            className="ca-chat-typing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            escribiendo…
          </motion.div>
        ) : null}
        <div ref={bottomRef} />
      </div>

      {pendingImage ? (
        <div className="ca-chat-pending">
          <img
            src={pendingImage.url}
            alt={pendingImage.fileName}
            loading="lazy"
            decoding="async"
          />
          <Button size="sm" variant="outline-secondary" onClick={onClearImage}>
            Quitar
          </Button>
        </div>
      ) : null}

      <Form
        className="ca-chat-composer"
        onSubmit={(e) => {
          e.preventDefault();
          onSend();
        }}
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => void onPickImage(e.target.files?.[0] ?? null)}
        />
        <button
          type="button"
          className="ca-chat-composer__icon"
          aria-label="Adjuntar imagen"
          onClick={() => fileRef.current?.click()}
        >
          <ImagePlus size={20} strokeWidth={1.9} />
        </button>
        <Form.Control
          className="ca-chat-composer__input"
          value={draft}
          placeholder="Mensaje"
          onChange={(e) => onDraftChange(e.target.value)}
          onBlur={onTypingBlur}
        />
        <button
          type="submit"
          className="ca-chat-composer__send"
          disabled={sendPending || (!draft.trim() && !pendingImage)}
          aria-label="Enviar"
        >
          {sendPending ? (
            <Spinner size="sm" animation="border" />
          ) : (
            <Send size={18} strokeWidth={2.2} />
          )}
        </button>
      </Form>
    </>
  );
}

function MessageBubble({ message, mine }: { message: ChatMessage; mine: boolean }) {
  const readByOthers = message.readBy.some((id) => id !== message.senderId);
  return (
    <motion.div
      className={`ca-chat-bubble${mine ? ' ca-chat-bubble--mine' : ''}`}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
    >
      {!mine ? (
        <VerifiedName
          className="ca-chat-bubble__name"
          name={message.senderName}
          verified={Boolean(message.senderIdentityVerified)}
        />
      ) : null}
      {message.attachments?.map((att, index) => (
        <a
          key={`${message.id}-att-${index}`}
          href={att.url}
          target="_blank"
          rel="noreferrer"
          className="ca-chat-bubble__image-link"
        >
          <img
            src={att.url}
            alt={att.fileName || 'Imagen'}
            className="ca-chat-bubble__image"
            loading="lazy"
            decoding="async"
          />
        </a>
      ))}
      {message.body && message.body !== '[imagen]' ? (
        <p className="ca-chat-bubble__body">{message.body}</p>
      ) : null}
      <div className="ca-chat-bubble__meta">
        <span>{formatTime(message.createdAt)}</span>
        {mine ? (
          <span
            className={`ca-chat-bubble__ticks${readByOthers ? ' ca-chat-bubble__ticks--read' : ''}`}
            title={readByOthers ? 'Leído' : 'Enviado'}
          >
            <CheckCheck size={14} strokeWidth={2.25} aria-hidden />
          </span>
        ) : null}
      </div>
    </motion.div>
  );
}
