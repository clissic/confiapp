import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

import { URUGUAY_CITIES } from '../../model/uruguay-cities';
import '../../styles/profile.css';

export interface UruguayCitySelectProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  invalid?: boolean;
  placeholder?: string;
}

export function UruguayCitySelect({
  id,
  value,
  onChange,
  onBlur,
  disabled,
  invalid,
  placeholder = 'Seleccionar ciudad',
}: UruguayCitySelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [...URUGUAY_CITIES];
    return URUGUAY_CITIES.filter((city) => city.toLowerCase().includes(q));
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

  const label = value.trim() || placeholder;

  return (
    <div
      className={`ca-dial-select ca-pref-select ca-city-select ${invalid ? 'ca-dial-select--invalid' : ''} ${!value.trim() ? 'ca-city-select--empty' : ''}`}
      ref={rootRef}
    >
      <button
        id={id}
        type="button"
        className="ca-dial-select__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={value.trim() ? `Ciudad: ${value}` : placeholder}
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setOpen((current) => !current);
        }}
      >
        <span className="ca-dial-select__label">{label}</span>
        <ChevronDown size={16} strokeWidth={1.75} className="ca-dial-select__chevron" aria-hidden />
      </button>
      {open && !disabled ? (
        <div className="ca-timezone-select__panel">
          <input
            type="search"
            className="form-control form-control-sm ca-timezone-select__search"
            placeholder="Buscar ciudad…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoFocus
          />
          <ul
            className="ca-dial-select__menu ca-timezone-select__menu"
            role="listbox"
            aria-label="Ciudades de Uruguay"
          >
            {filtered.length === 0 ? (
              <li className="ca-city-select__empty" role="presentation">
                Sin resultados
              </li>
            ) : (
              filtered.map((city) => {
                const isActive = city === value;
                return (
                  <li key={city} role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      className={`ca-dial-select__option ${isActive ? 'ca-dial-select__option--active' : ''}`}
                      onClick={() => {
                        onChange(city);
                        setOpen(false);
                        setQuery('');
                        onBlur?.();
                      }}
                    >
                      <span className="ca-dial-select__label">{city}</span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
