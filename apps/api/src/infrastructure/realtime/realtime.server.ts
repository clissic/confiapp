/**
 * Socket.io server adapter (pendiente de implementación).
 * Responsabilidad: rooms por transacción, auth de socket, broadcast de eventos.
 */
export interface RealtimeServerPort {
  start(httpServer: unknown): Promise<void>;
  stop(): Promise<void>;
}
