import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

function maskAccountNumber(value: string, revealed: boolean): string {
  if (revealed || value.length <= 4) return value;
  return `${'*'.repeat(value.length - 4)}${value.slice(-4)}`;
}

export function MaskedAccountNumber({ number }: { number: string }) {
  const [revealed, setRevealed] = useState(false);

  return (
    <span className="ca-masked-account">
      <span className="ca-masked-account__text">
        Nro.: {maskAccountNumber(number, revealed)}
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
