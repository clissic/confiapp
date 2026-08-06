import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Monitor, Moon, Sun } from 'lucide-react';

import type { ThemePreference } from '../../model/types';

const THEME_OPTIONS: Array<{
  code: ThemePreference;
  label: string;
  Icon: typeof Monitor;
}> = [
  { code: 'SYSTEM', label: 'Sistema', Icon: Monitor },
  { code: 'LIGHT', label: 'Claro', Icon: Sun },
  { code: 'DARK', label: 'Oscuro', Icon: Moon },
];

export interface ThemeSelectProps {
  id?: string;
  value: ThemePreference;
  onChange: (value: ThemePreference) => void;
  onBlur?: () => void;
}

export function ThemeSelect({ id, value, onChange, onBlur }: ThemeSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = THEME_OPTIONS.find((item) => item.code === value) ?? THEME_OPTIONS[0]!;
  const SelectedIcon = selected.Icon;

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
        aria-label={`Tema: ${selected.label}`}
        onClick={() => setOpen((current) => !current)}
      >
        <SelectedIcon size={16} strokeWidth={1.75} aria-hidden />
        <span className="ca-dial-select__label">{selected.label}</span>
        <ChevronDown size={16} strokeWidth={1.75} className="ca-dial-select__chevron" aria-hidden />
      </button>
      {open ? (
        <ul className="ca-dial-select__menu" role="listbox" aria-label="Temas">
          {THEME_OPTIONS.map((item) => {
            const Icon = item.Icon;
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
                  <Icon size={16} strokeWidth={1.75} aria-hidden />
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
