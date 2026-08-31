import { STATUS_LABELS, type TransactionStatus } from '../model/types';

/** Notas técnicas guardadas → copy amigable en el historial. */
const HISTORY_NOTE_LABELS: Record<string, string> = {
  'Escrow fondeado vía Mercado Pago (retención)':
    'Pago protegido confirmado con Mercado Pago',
  'Pago protegido confirmado con Mercado Pago':
    'Pago protegido confirmado con Mercado Pago',
  'Pago protegido por transferencia Prex (MVP) — comprobante cargado':
    'Pago protegido por transferencia Prex',
  'Pago protegido confirmado por admin tras revisar comprobante Prex':
    'ConfiApp confirmó que la transferencia es correcta',
  'Comprador envió el comprobante de transferencia — pendiente de verificación':
    'El comprador ya pagó. ConfiApp está revisando el comprobante de la transferencia',
  'Admin marcó la transferencia Prex como no confirmada':
    'ConfiApp pidió revisar de nuevo el comprobante de la transferencia',
  'ConfiApp pidió revisar de nuevo el comprobante de la transferencia':
    'ConfiApp pidió revisar de nuevo el comprobante de la transferencia',
  'Comprador aceptó la compra — acuerdo cerrado, pendiente de fondeo':
    'Comprador aceptó la compra — acuerdo cerrado, pendiente de pago',
  'Vendedor confirmó la venta — acuerdo cerrado, pendiente de fondeo':
    'Vendedor confirmó la venta — acuerdo cerrado, pendiente de pago',
  'Pago liberado: neto al vendedor, comisión ConfiApp/agente':
    'Fondos liberados al vendedor',
  'Escrow liberado: neto vendedor, fee 20% plataforma, pago agente':
    'Fondos liberados al vendedor',
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
