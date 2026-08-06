import { useEffect, useMemo, useRef, useState, type ReactElement, type SVGProps } from 'react';
import { ChevronDown } from 'lucide-react';
import { hasFlag } from 'country-flag-icons';
import * as FlagComponents from 'country-flag-icons/react/3x2';

import {
  COUNTRY_DIAL_CODES,
  findCountryByIso,
  type CountryDialCode,
} from '../../model/country-dial-codes';
import '../../styles/profile.css';

type FlagComponent = (props: SVGProps<SVGSVGElement>) => ReactElement;

export function CountryFlag({ iso }: { iso: string }) {
  if (!hasFlag(iso)) {
    return (
      <span className="ca-flag ca-flag--fallback" aria-hidden>
        {iso}
      </span>
    );
  }

  const Flag = (FlagComponents as Record<string, FlagComponent>)[iso];
  if (!Flag) {
    return (
      <span className="ca-flag ca-flag--fallback" aria-hidden>
        {iso}
      </span>
    );
  }

  return <Flag className="ca-flag" aria-hidden />;
}

/** Países habilitados en el desplegable por nombre (perfil / área). */
const ENABLED_COUNTRY_NAME_ISOS = new Set(['UY']);

export interface CountrySelectProps {
  value: string;
  onChange: (iso: string) => void;
  onBlur?: () => void;
  invalid?: boolean;
  id?: string;
  disabled?: boolean;
  /** `dial` = bandera + código; `name` = bandera + nombre del país */
  variant?: 'dial' | 'name';
}

/** Desplegable de país con banderas SVG (country-flag-icons). */
export function CountrySelect({
  value,
  onChange,
  onBlur,
  invalid,
  id,
  disabled,
  variant = 'name',
}: CountrySelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => findCountryByIso(value) ?? COUNTRY_DIAL_CODES[0]!,
    [value],
  );

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

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  function isCountryEnabled(iso: string) {
    if (variant === 'dial') return true;
    return ENABLED_COUNTRY_NAME_ISOS.has(iso);
  }

  function pick(country: CountryDialCode) {
    if (!isCountryEnabled(country.iso)) return;
    onChange(country.iso);
    setOpen(false);
    onBlur?.();
  }

  const labelPrimary = variant === 'dial' ? selected.dial : selected.name;

  return (
    <div
      className={`ca-dial-select ca-country-select ca-country-select--${variant} ${invalid ? 'ca-dial-select--invalid' : ''}`}
      ref={rootRef}
    >
      <button
        id={id}
        type="button"
        className="ca-dial-select__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`País: ${selected.name}`}
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setOpen((current) => !current);
        }}
      >
        <CountryFlag iso={selected.iso} />
        <span className="ca-dial-select__label">{labelPrimary}</span>
        <ChevronDown size={16} strokeWidth={1.75} className="ca-dial-select__chevron" aria-hidden />
      </button>

      {open && !disabled ? (
        <ul className="ca-dial-select__menu" role="listbox" aria-label="Lista de países">
          {COUNTRY_DIAL_CODES.map((country) => {
            const isActive = country.iso === selected.iso;
            const optionEnabled = isCountryEnabled(country.iso);
            return (
              <li key={country.iso} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  aria-disabled={!optionEnabled}
                  disabled={!optionEnabled}
                  className={`ca-dial-select__option ${isActive ? 'ca-dial-select__option--active' : ''} ${!optionEnabled ? 'ca-dial-select__option--disabled' : ''}`}
                  onClick={() => pick(country)}
                >
                  <CountryFlag iso={country.iso} />
                  <span className="ca-dial-select__label">
                    {variant === 'dial' ? country.dial : country.name}
                  </span>
                  {variant === 'name' ? (
                    <span className="ca-dial-select__meta">{country.iso}</span>
                  ) : (
                    <span className="visually-hidden">{country.name}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

/** Alias: desplegable de código telefónico (bandera + dial). */
export function CountryDialSelect(props: Omit<CountrySelectProps, 'variant'>) {
  return <CountrySelect {...props} variant="dial" />;
}
