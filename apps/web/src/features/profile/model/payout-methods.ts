/** Bancos y billeteras electrónicas soportadas (UY) — guía Latias Ajustes. */

export const FINTECH_BANKS = ['MERCADO PAGO', 'PREX', 'OCA BLUE', 'MIDINERO'] as const;

export const PAYOUT_BANK_OPTIONS = [
  'MERCADO PAGO',
  'BROU',
  'SCOTIABANK',
  'PREX',
  'OCA BLUE',
  'CITI',
  'ITAU',
  'HSBC',
  'BHU',
  'SANTANDER',
  'HERITAGE',
  'BANDES',
  'BBVA',
  'NACION ARGENTINA',
  'MIDINERO',
] as const;

export type PayoutBank = (typeof PAYOUT_BANK_OPTIONS)[number];
export type PayoutAccountKind = 'CA' | 'CC' | 'FINTECH';
export type PayoutCurrency = 'UYU' | 'USD' | '';

export const PAYOUT_ACCOUNT_KIND_OPTIONS: Array<{ value: PayoutAccountKind; label: string }> = [
  { value: 'CA', label: 'Caja de ahorro (CA)' },
  { value: 'CC', label: 'Cuenta corriente (CC)' },
];

export const PAYOUT_CURRENCY_OPTIONS: Array<{
  value: Exclude<PayoutCurrency, ''>;
  label: string;
  disabled?: boolean;
}> = [
  { value: 'UYU', label: 'UYU $' },
  { value: 'USD', label: 'USD $', disabled: true },
];

/** Textos de ayuda por banco / billetera (formato de número de cuenta — Latias Ajustes). */
export const PAYOUT_BANK_HELP: Record<string, string> = {
  'MERCADO PAGO':
    'Podés obtener el número de cuenta en la App de Mercado Pago, en la sección de "Ingresar".',
  BROU: 'El número de cuenta del BROU tiene 14 dígitos corridos, sin guiones ni espacios.',
  SCOTIABANK:
    'La identificación de la cuenta tiene 10 caracteres de largo. Rellenar con ceros a la izquierda hasta completar el largo. (CCCCCCCZII) 7 dígitos que corresponden al número de cliente. Z es el dígito verificador (II) 2 dígitos que corresponden a la identificación de la cuenta.',
  PREX:
    'La identificación de la cuenta tiene un máximo de 8 caracteres. No se rellena con 0s a la izquierda, no debe tener espacios ni otros caracteres no numéricos.',
  'OCA BLUE':
    'La identificación de cuenta tiene 7 caracteres de largo rellenando con ceros a la izquierda siempre hasta completar el largo.',
  CITI:
    'La identificación de cuenta tiene 10 caracteres de largo sin espacios y rellenando con ceros a la izquierda siempre hasta completar el largo. Los números de cuenta comienzan con 0, 1 o 5.',
  ITAU:
    'La identificación de cuenta tiene 7 caracteres de largo rellenando con ceros a la izquierda siempre hasta completar el largo.',
  HSBC:
    'La identificación de la cuenta tiene entre 4 y 10 caracteres de largo. No rellenar con 0.',
  BHU: '12 dígitos (XXXYYZZZZZZV) en total: (XXX) 3 dígitos corresponden a las Sucursales y siempre comienza con cero. (YY) corresponden al producto de la cuenta (ZZZZZZ) 6 dígitos corresponden al número de la cuenta rellenando con ceros a la izquierda hasta completar la cantidad de dígitos. (V) 1 dígito corresponde al dígito verificador.',
  SANTANDER:
    'La identificación de la cuenta tiene un largo de 16 dígitos. Detalle (SSSS) 4 dígitos que corresponden a la sucursal. Se rellena de 0 a la izquierda hasta completar el largo. (CCCCCCCCCCCC) 12 dígitos para la identificación de la cuenta. Se rellena de 0 a la izquierda hasta completar el largo.',
  HERITAGE:
    'La identificación de cuenta está formada por dos secciones. La primera tiene 7 caracteres de largo rellenando con ceros a la izquierda y la segunda corresponde a la subcuenta y tiene 2 caracteres de largo. Detalle (XXXXXXX) 7 dígitos corresponden a la cuenta (YY) 2 dígitos corresponden a la subcuenta.',
  BANDES:
    'Ingresá el número de cuenta sin espacios ni guiones, solo dígitos, según el formato de tu extracto BANDES.',
  BBVA:
    'La identificación de la cuenta tiene un máximo de 9 caracteres. No se rellena con 0s a la izquierda. No debe tener espacios ni otros caracteres no numéricos.',
  'NACION ARGENTINA': 'La identificación de la cuenta tiene un máximo de 12 caracteres.',
  MIDINERO:
    'La identificación de cuenta puede tener entre 3 y 11 dígitos. No debe contener espacios ni otros caracteres no numéricos. No se rellena con ceros a la izquierda. El número de cuenta lo obtenés al consultar tus productos en MiDinero App o en TuCajero, en la opción Consulta de Movimientos.',
};

export function isFintechBank(bank: string): boolean {
  return (FINTECH_BANKS as readonly string[]).includes(bank);
}

export function getPayoutBankHelp(bank: string): string | undefined {
  return PAYOUT_BANK_HELP[bank];
}

/** Solo dígitos; útil para tipado en el input del número de cuenta. */
export function sanitizePayoutAccountNumber(value: string): string {
  return value.replace(/\D/g, '').slice(0, 32);
}

export function formatPayoutMethodType(method: {
  type: PayoutAccountKind;
  currency: PayoutCurrency;
}): string {
  if (method.type === 'FINTECH') return 'Billetera electrónica';
  const kind = method.type === 'CA' ? 'Caja de ahorro' : 'Cuenta corriente';
  return method.currency ? `${kind} · ${method.currency}` : kind;
}
