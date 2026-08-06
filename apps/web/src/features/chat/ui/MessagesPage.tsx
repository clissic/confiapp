import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Alert, Badge, Button, Form, Spinner } from 'react-bootstrap';
import { motion } from 'framer-motion';
import { CheckCheck, ImagePlus, MessageSquare, Send } from 'lucide-react';

import { formatTime } from '@/shared/lib/money';
import { VerifiedName } from '@/shared/ui/VerifiedName';
import {
  useChatMessages,
  useChats,
  useSendChatMessage,
} from '../hooks/useChat';
import { emitMarkRead, emitTyping, useChatRealtime } from '../hooks/useChatRealtime';
import { markChatRead } from '../api/chat.api';
import type { ChatMessage } from '../model/types';
import '../styles/chat.css';


function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
    reader.readAsDataURL(file);
  });
}

export function MessagesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: chatsData, isFetching: loadingChats } = useChats();
  const chats = chatsData?.items ?? [];
  const selectedId = searchParams.get('chat') || chats[0]?.id || null;

  const { data: messagesData, isFetching: loadingMessages } = useChatMessages(selectedId);
  const messages = messagesData?.items ?? [];
  const send = useSendChatMessage(selectedId);
  const { typingUserId, connectionState, me } = useChatRealtime(selectedId);

  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pendingImage, setPendingImage] = useState<{
    url: string;
    fileName: string;
    mimeType: string;
  } | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const markedRef = useRef<Set<string>>(new Set());

  const selected = useMemo(
    () => chats.find((c) => c.id === selectedId) ?? null,
    [chats, selectedId],
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, typingUserId]);

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

  const connectionLabel =
    connectionState === 'online'
      ? 'En línea'
      : connectionState === 'reconnecting'
        ? 'Reconectando…'
        : connectionState === 'connecting'
          ? 'Conectando…'
          : 'Sin conexión';

  return (
    <div className="ca-chat">
      <header className="ca-chat__header">
        <div>
          <p className="ca-chat__kicker">Mensajes</p>
          <h2 className="ca-chat__title">Chats de operación</h2>
          <p className="ca-chat__lead">
            Comprador ↔ Agente y Vendedor ↔ Agente · tiempo real con Socket.io
          </p>
        </div>
        <Badge bg={connectionState === 'online' ? 'success' : 'secondary'}>
          {connectionLabel}
        </Badge>
      </header>

      {error ? <Alert variant="danger">{error}</Alert> : null}

      <div className="ca-chat__layout">
        <aside className="ca-chat-panel ca-chat__list">
          <div className="ca-chat-panel__head">
            <strong>Conversaciones</strong>
            {loadingChats ? <Spinner size="sm" animation="border" /> : null}
          </div>
          {chats.length === 0 ? (
            <div className="ca-chat__empty">
              <MessageSquare size={28} />
              <p>No hay chats aún. Se crean al aceptar un agente.</p>
            </div>
          ) : (
            <ul className="ca-chat-threads">
              {chats.map((chat) => {
                const active = chat.id === selectedId;
                return (
                  <li key={chat.id}>
                    <button
                      type="button"
                      className={`ca-chat-thread ${active ? 'ca-chat-thread--active' : ''}`}
                      onClick={() => selectChat(chat.id)}
                    >
                      <div className="ca-chat-thread__row">
                        <strong>{chat.label}</strong>
                        {chat.unreadCount > 0 ? (
                          <Badge bg="danger" pill>
                            {chat.unreadCount}
                          </Badge>
                        ) : null}
                      </div>
                      <span className="ca-chat-thread__meta">
                        {chat.transactionCode || '—'} · {chat.transactionTitle || 'Operación'}
                      </span>
                      <span className="ca-chat-thread__preview">
                        {chat.lastMessagePreview || 'Sin mensajes'}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        <section className="ca-chat-panel ca-chat__room">
          {!selected ? (
            <div className="ca-chat__empty">
              <MessageSquare size={32} />
              <p>Elegí una conversación</p>
            </div>
          ) : (
            <>
              <div className="ca-chat-panel__head">
                <div>
                  <strong>{selected.label}</strong>
                  <div className="ca-chat-thread__meta">
                    {selected.participants.map((p, index) => (
                      <span key={p.id}>
                        {index > 0 ? ' · ' : null}
                        <VerifiedName name={p.name} verified={Boolean(p.identityVerified)} />
                      </span>
                    ))}
                  </div>
                </div>
                {loadingMessages ? <Spinner size="sm" animation="border" /> : null}
              </div>

              <div className="ca-chat-messages">
                {messages.map((msg) => (
                  <MessageBubble key={msg.id} message={msg} mine={msg.senderId === me} />
                ))}
                {typingUserId ? (
                  <motion.div
                    className="ca-chat-typing"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    Escribiendo…
                  </motion.div>
                ) : null}
                <div ref={bottomRef} />
              </div>

              {pendingImage ? (
                <div className="ca-chat-pending-image">
                  <img
                    src={pendingImage.url}
                    alt={pendingImage.fileName}
                    loading="lazy"
                    decoding="async"
                  />
                  <Button
                    size="sm"
                    variant="outline-secondary"
                    onClick={() => setPendingImage(null)}
                  >
                    Quitar
                  </Button>
                </div>
              ) : null}

              <Form
                className="ca-chat-composer"
                onSubmit={(e) => {
                  e.preventDefault();
                  void onSend();
                }}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => void onPickImage(e.target.files?.[0] ?? null)}
                />
                <Button
                  type="button"
                  variant="outline-secondary"
                  aria-label="Adjuntar imagen"
                  onClick={() => fileRef.current?.click()}
                >
                  <ImagePlus size={18} />
                </Button>
                <Form.Control
                  value={draft}
                  placeholder="Escribí un mensaje…"
                  onChange={(e) => onDraftChange(e.target.value)}
                  onBlur={() => selectedId && emitTyping(selectedId, false)}
                />
                <Button
                  type="submit"
                  className="ca-btn-cta"
                  disabled={send.isPending || (!draft.trim() && !pendingImage)}
                >
                  {send.isPending ? (
                    <Spinner size="sm" animation="border" />
                  ) : (
                    <Send size={18} />
                  )}
                </Button>
              </Form>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function MessageBubble({ message, mine }: { message: ChatMessage; mine: boolean }) {
  const readByOthers = message.readBy.some((id) => id !== message.senderId);
  return (
    <motion.div
      className={`ca-chat-bubble ${mine ? 'ca-chat-bubble--mine' : ''}`}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
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
          <span className={readByOthers ? 'ca-chat-bubble__read' : ''} title={readByOthers ? 'Leído' : 'Enviado'}>
            <CheckCheck size={14} />
          </span>
        ) : null}
      </div>
    </motion.div>
  );
}
