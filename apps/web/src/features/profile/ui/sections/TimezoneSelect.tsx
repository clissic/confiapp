import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

import '../../styles/profile.css';

function listTimeZones(): string[] {
  try {
    if (typeof Intl !== 'undefined' && 'supportedValuesOf' in Intl) {
      return (Intl as unknown as { supportedValuesOf: (key: string) => string[] }).supportedValuesOf(
        'timeZone',
      );
    }
  } catch {
    /* ignore */
  }
  return [
    'America/Montevideo',
    'America/Argentina/Buenos_Aires',
    'America/Sao_Paulo',
    'America/Santiago',
    'UTC',
  ];
}

const ALL_TIMEZONES = listTimeZones();

export interface TimezoneSelectProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
}

export function TimezoneSelect({ id, value, onChange, onBlur, disabled }: TimezoneSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = value || ALL_TIMEZONES[0]!;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ALL_TIMEZONES;
    return ALL_TIMEZONES.filter((zone) => zone.toLowerCase().includes(q));
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery('');
        onBlur?.();
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        setQuery('');
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

  useEffect(() => {
    if (disabled) {
      setOpen(false);
      setQuery('');
    }
  }, [disabled]);

  return (
    <div className="ca-dial-select ca-pref-select ca-timezone-select" ref={rootRef}>
      <button
        id={id}
        type="button"
        className="ca-dial-select__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Zona horaria: ${selected}`}
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setOpen((current) => !current);
        }}
      >
        <span className="ca-dial-select__label">{selected}</span>
        <ChevronDown size={16} strokeWidth={1.75} className="ca-dial-select__chevron" aria-hidden />
      </button>
      {open && !disabled ? (
        <div className="ca-timezone-select__panel">
          <input
            type="search"
            className="form-control form-control-sm ca-timezone-select__search"
            placeholder="Buscar zona…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoFocus
          />
          <ul className="ca-dial-select__menu ca-timezone-select__menu" role="listbox" aria-label="Zonas horarias">
            {filtered.slice(0, 200).map((zone) => {
              const isActive = zone === selected;
              return (
                <li key={zone} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    className={`ca-dial-select__option ${isActive ? 'ca-dial-select__option--active' : ''}`}
                    onClick={() => {
                      onChange(zone);
                      setOpen(false);
                      setQuery('');
                      onBlur?.();
                    }}
                  >
                    <span className="ca-dial-select__label">{zone}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
