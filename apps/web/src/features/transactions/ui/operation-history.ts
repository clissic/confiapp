import { STATUS_LABELS, type TransactionStatus } from '../model/types';

/** Notas técnicas guardadas → copy amigable en el historial. */
const HISTORY_NOTE_LABELS: Record<string, string> = {
  'Escrow fondeado vía Mercado Pago (retención)':
    'Servicio del Agente pagado con Mercado Pago',
  'Pago protegido confirmado con Mercado Pago':
    'Servicio del Agente pagado con Mercado Pago',
  'Servicio del Agente pagado con Mercado Pago':
    'Servicio del Agente pagado con Mercado Pago',
  'Contratación del Agente confirmada con Mercado Pago':
    'Servicio del Agente pagado con Mercado Pago',
  'Pago protegido por transferencia Prex (MVP) — comprobante cargado':
    'Servicio del Agente pagado por transferencia manual',
  'Pago protegido confirmado por admin tras revisar comprobante Prex':
    'Servicio del Agente confirmado tras revisar el comprobante',
  'Servicio del Agente confirmado por admin tras revisar comprobante Prex':
    'Servicio del Agente confirmado tras revisar el comprobante',
  'Comprador envió el comprobante de transferencia — pendiente de verificación':
    'El comprador ya pagó. ConfiApp está revisando el comprobante de la transferencia',
  'Admin marcó la transferencia Prex como no confirmada':
    'ConfiApp pidió revisar de nuevo el comprobante',
  'ConfiApp pidió revisar de nuevo el comprobante de la transferencia':
    'ConfiApp pidió revisar de nuevo el comprobante de la transferencia',
  'Comprador aceptó la compra — acuerdo cerrado, pendiente de fondeo':
    'Comprador aceptó la compra — acuerdo cerrado, pendiente de pago',
  'Vendedor confirmó la venta — acuerdo cerrado, pendiente de fondeo':
    'Vendedor confirmó la venta — acuerdo cerrado, pendiente de pago',
  'Pago liberado: neto al vendedor, comisión ConfiApp/agente':
    'Entrega confirmada — operación cerrada',
  'Escrow liberado: neto vendedor, fee 30% plataforma, pago agente':
    'Entrega confirmada — operación cerrada',
  'Fondos liberados al vendedor':
    'Entrega confirmada — operación cerrada',
  'Fondos liberados al vendedor (confirmación automática tras 72h)':
    'Entrega confirmada — operación cerrada',
  'Entrega confirmada — operación cerrada':
    'Entrega confirmada — operación cerrada',
  'Entrega confirmada — operación cerrada (confirmación automática tras 72h)':
    'Entrega confirmada — operación cerrada',
  'Operación completada — comisión Agente pendiente en wallet':
    'Operación cerrada — comisión del Agente pendiente en wallet',
  'Operación completada (auto 72h) — comisión Agente pendiente en wallet':
    'Operación cerrada — comisión del Agente pendiente en wallet',
  'Disputa resuelta: reembolso al comprador':
    'Disputa resuelta: reembolso de la contratación del Agente',
  'Disputa resuelta: reembolso de la contratación del Agente':
    'Disputa resuelta: reembolso de la contratación del Agente',
};

export function friendlyHistoryNote(note?: string): string | undefined {
  if (!note) return undefined;
  return HISTORY_NOTE_LABELS[note] ?? note;
}

/** Label del historial: aceptación de agente ≠ “Aceptada” del acuerdo. */
export function historyStatusLabel(event: {
  status: TransactionStatus;
  note?: string;
}): string {
  const note = (event.note ?? '').toLowerCase();
  if (
    note.includes('agente solicitó salida') ||
    note.includes('salida / reasignación')
  ) {
    return 'Agente saliente';
  }
  if (
    note.includes('agente aceptó el trabajo') ||
    note.includes('agente intermediario aceptó') ||
    note.includes('desde el tablero de trabajos abiertos')
  ) {
    return 'Agenciada';
  }
  if (
    note.includes('comprobante de transferencia') ||
    note.includes('envió el comprobante') ||
    note.includes('revisar de nuevo el comprobante') ||
    note.includes('no confirmada')
  ) {
    return note.includes('no confirmada') || note.includes('revisar de nuevo')
      ? 'Revisión del pago'
      : 'Comprobante enviado';
  }
  if (note.includes('confirmó que la transferencia') || note.includes('tras revisar comprobante')) {
    return 'Pago verificado';
  }
  return STATUS_LABELS[event.status];
}
