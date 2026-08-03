import { io, type Socket } from 'socket.io-client';

import { env } from '@/shared/config/env';

let socket: Socket | null = null;
let subscribers = 0;

/** Cliente Socket.io autenticado con JWT y reconexión automática. */
export function connectRealtimeSocket(accessToken: string): Socket {
  subscribers += 1;

  if (!socket) {
    socket = io(env.apiUrl || undefined, {
      autoConnect: false,
      transports: ['websocket', 'polling'],
      auth: { token: accessToken },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 800,
      reconnectionDelayMax: 10_000,
      randomizationFactor: 0.4,
      timeout: 12_000,
    });
  } else {
    socket.auth = { token: accessToken };
  }

  if (!socket.connected) {
    socket.connect();
  }
  return socket;
}

export function getRealtimeSocket(): Socket | null {
  return socket;
}

/** Actualiza el token para el próximo intento de reconexión. */
export function refreshRealtimeAuth(accessToken: string): void {
  if (!socket) return;
  socket.auth = { token: accessToken };
}

/**
 * Libera una suscripción. Solo desconecta cuando no quedan consumidores
 * (evita cortar el socket al salir de una sola página).
 */
export function releaseRealtimeSocket(): void {
  subscribers = Math.max(0, subscribers - 1);
  if (subscribers > 0 || !socket) return;
  socket.disconnect();
  socket = null;
}

/** @deprecated Preferí releaseRealtimeSocket para no romper otras vistas. */
export function disconnectRealtimeSocket(): void {
  subscribers = 0;
  if (!socket) return;
  socket.disconnect();
  socket = null;
}
