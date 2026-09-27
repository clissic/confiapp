import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

import './masked-account.css';

function maskAccountNumber(value: string, revealed: boolean): string {
  if (revealed || value.length <= 4) return value;
  return `•••• ${value.replace(/\D/g, '').slice(-4) || value.slice(-4)}`;
}

type MaskedAccountNumberProps = {
  number: string;
  /** Prefijo visible; pasá `""` para mostrar solo el número. */
  label?: string;
};

/** Número de cuenta/método de cobro con toggle ojo para revelar. */
export function MaskedAccountNumber({ number, label = 'Nro.:' }: MaskedAccountNumberProps) {
  const [revealed, setRevealed] = useState(false);
  const prefix = label.trim() ? `${label.trim()} ` : '';

  return (
    <span className="ca-masked-account">
      <span className={`ca-masked-account__text${revealed ? ' is-revealed' : ''}`}>
        {prefix}
        {maskAccountNumber(number, revealed)}
      </span>
      <button
        type="button"
        className="ca-masked-account__toggle"
        aria-label={revealed ? 'Ocultar número de cuenta' : 'Mostrar número de cuenta'}
        aria-pressed={revealed}
        onClick={() => setRevealed((value) => !value)}
      >
        {revealed ? (
          <EyeOff size={14} strokeWidth={1.75} aria-hidden />
        ) : (
          <Eye size={14} strokeWidth={1.75} aria-hidden />
        )}
      </button>
    </span>
  );
}
