import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

import { CURRENCY_OPTIONS, type AppCurrency } from '@/shared/lib/money';

export interface CurrencySelectProps {
  id?: string;
  value: string;
  onChange: (value: AppCurrency) => void;
  onBlur?: () => void;
}

export function CurrencySelect({ id, value, onChange, onBlur }: CurrencySelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected =
    CURRENCY_OPTIONS.find((item) => item.code === value.toUpperCase()) ?? CURRENCY_OPTIONS[0]!;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        onBlur?.();
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        onBlur?.();
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onBlur]);

  return (
    <div className="ca-dial-select ca-pref-select" ref={rootRef}>
      <button
        id={id}
        type="button"
        className="ca-dial-select__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Moneda: ${selected.label}`}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="ca-dial-select__label">{selected.label}</span>
        <ChevronDown size={16} strokeWidth={1.75} className="ca-dial-select__chevron" aria-hidden />
      </button>
      {open ? (
        <ul className="ca-dial-select__menu" role="listbox" aria-label="Monedas">
          {CURRENCY_OPTIONS.map((item) => {
            const isActive = item.code === selected.code;
            const isDisabled = Boolean(item.disabled);
            return (
              <li key={item.code} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  aria-disabled={isDisabled}
                  disabled={isDisabled}
                  className={`ca-dial-select__option ${isActive ? 'ca-dial-select__option--active' : ''} ${isDisabled ? 'ca-dial-select__option--disabled' : ''}`}
                  onClick={() => {
                    if (isDisabled) return;
                    onChange(item.code);
                    setOpen(false);
                    onBlur?.();
                  }}
                >
                  <span className="ca-dial-select__label">
                    {item.label}
                    {isDisabled ? ' (próximamente)' : ''}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
