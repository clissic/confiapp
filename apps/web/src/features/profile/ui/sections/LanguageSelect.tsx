import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

import { CountryFlag } from './CountryDialSelect';

export const APP_LANGUAGES = [
  { code: 'es', label: 'Español', flagIso: 'ES' },
  { code: 'en', label: 'English', flagIso: 'GB' },
  { code: 'pt', label: 'Português', flagIso: 'PT' },
] as const;

export type AppLanguageCode = (typeof APP_LANGUAGES)[number]['code'];

export function normalizeAppLanguage(value: string | undefined): AppLanguageCode {
  const normalized = (value ?? 'es').trim().toLowerCase();
  if (normalized.startsWith('en')) return 'en';
  if (normalized.startsWith('pt')) return 'pt';
  return 'es';
}

export interface LanguageSelectProps {
  id?: string;
  value: string;
  onChange: (code: AppLanguageCode) => void;
  onBlur?: () => void;
}

/** Selector de idioma de la app (aún sin i18n activo). */
export function LanguageSelect({ id, value, onChange, onBlur }: LanguageSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected =
    APP_LANGUAGES.find((item) => item.code === normalizeAppLanguage(value)) ?? APP_LANGUAGES[0];

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
    <div className="ca-dial-select ca-language-select" ref={rootRef}>
      <button
        id={id}
        type="button"
        className="ca-dial-select__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Idioma: ${selected.label}`}
        onClick={() => setOpen((current) => !current)}
      >
        <CountryFlag iso={selected.flagIso} />
        <span className="ca-dial-select__label">{selected.label}</span>
        <ChevronDown size={16} strokeWidth={1.75} className="ca-dial-select__chevron" aria-hidden />
      </button>

      {open ? (
        <ul className="ca-dial-select__menu" role="listbox" aria-label="Idiomas disponibles">
          {APP_LANGUAGES.map((item) => {
            const isActive = item.code === selected.code;
            return (
              <li key={item.code} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  className={`ca-dial-select__option ${isActive ? 'ca-dial-select__option--active' : ''}`}
                  onClick={() => {
                    onChange(item.code);
                    setOpen(false);
                    onBlur?.();
                  }}
                >
                  <CountryFlag iso={item.flagIso} />
                  <span className="ca-dial-select__label">{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
