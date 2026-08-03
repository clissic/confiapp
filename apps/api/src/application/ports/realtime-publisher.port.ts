/**
 * Puerto de aplicación para publicar eventos en tiempo real.
 * Los use cases dependen de esta abstracción, no de Socket.io.
 */
export interface RealtimePublisherPort {
  publish(room: string, event: string, payload: unknown): void;
}
