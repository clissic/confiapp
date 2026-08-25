import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';

import {
  composePhoneNumber,
  DEFAULT_COUNTRY_ISO,
} from '@/features/profile/model/country-dial-codes';
import { CountryDialSelect } from '@/features/profile/ui/sections/CountryDialSelect';

import { registerRequest } from '../api/auth.api';
import { isStrongPassword } from '../lib/password';
import { clearLocalVerifiedPhone } from '@/features/profile/model/phone-verification';
import { AuthBrand } from './AuthBrand';
import { useAuth } from './AuthProvider';
import { PasswordInput } from './PasswordInput';
import { PasswordRequirementsList } from './PasswordRequirementsList';
import '../styles/auth.css';

function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/inicio';
  if (raw === '/' || raw === '/ingresar' || raw === '/registro') return '/inicio';
  return raw;
}

const DOCUMENT_RE = /^[A-Za-z0-9][A-Za-z0-9.\-\s/]*$/;

/** Alta de cuenta — requiere confirmación de email antes de ingresar. */
export function RegisterPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNextPath(params.get('next'));
  const { isAuthenticated, isBootstrapping } = useAuth();

  const [fullName, setFullName] = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [countryIso, setCountryIso] = useState(DEFAULT_COUNTRY_ISO);
  const [nationalNumber, setNationalNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const name = fullName.trim();
    const documento = documentNumber.trim();
    const mail = email.trim();
    const localPhone = nationalNumber.replace(/\D/g, '');

    if (name.length < 2) {
      setError('El nombre completo debe tener al menos 2 caracteres.');
      return;
    }
    if (documento.length < 5 || !DOCUMENT_RE.test(documento)) {
      setError('Ingresá un DNI o pasaporte válido (mín. 5 caracteres).');
      return;
    }
    if (localPhone.length < 6 || localPhone.length > 15) {
      setError('Ingresá un teléfono válido (6 a 15 dígitos, sin el código de país).');
      return;
    }
    if (!isStrongPassword(password)) {
      setError('La contraseña no cumple todos los requisitos.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    if (!acceptedTerms) {
      setError('Tenés que aceptar los Términos y Condiciones para crear la cuenta.');
      return;
    }

    const phone = composePhoneNumber(countryIso, localPhone);

    setLoading(true);
    try {
      clearLocalVerifiedPhone();
      await registerRequest({
        email: mail,
        password,
        fullName: name,
        documentNumber: documento,
        phone,
      });
      navigate(
        `/verificar-email?email=${encodeURIComponent(mail)}&next=${encodeURIComponent(next)}`,
        { replace: true },
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la cuenta');
    } finally {
      setLoading(false);
    }
  }

  if (!isBootstrapping && isAuthenticated) {
    return <Navigate to={next} replace />;
  }

  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const confirmMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  return (
    <div className="ca-auth">
      <div className="ca-auth__card">
        <AuthBrand />
        <h1 className="ca-auth__title">Crear cuenta</h1>
        <p className="ca-auth__lead">
          Empezá a comprar, vender o llevar productos como Agente, con pago protegido.
        </p>

        <form className="ca-auth__form" onSubmit={onSubmit} noValidate>
          {error ? <p className="ca-auth__error">{error}</p> : null}

          <label className="ca-auth__label">
            Nombre completo
            <input
              className="ca-auth__input"
              type="text"
              name="name"
              autoComplete="name"
              required
              minLength={2}
              maxLength={120}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </label>

          <label className="ca-auth__label">
            DNI / Pasaporte
            <input
              className="ca-auth__input"
              type="text"
              name="document-number"
              autoComplete="off"
              required
              minLength={5}
              maxLength={32}
              placeholder="12345678"
              value={documentNumber}
              onChange={(e) => setDocumentNumber(e.target.value)}
            />
          </label>

          <div className="ca-auth__phone">
            <span className="ca-auth__label-text">Teléfono</span>
            <div className="ca-auth__phone-row">
              <CountryDialSelect
                id="register-phone-country"
                value={countryIso}
                onChange={setCountryIso}
              />
              <input
                className="ca-auth__input"
                type="tel"
                name="tel-national"
                autoComplete="tel-national"
                inputMode="numeric"
                required
                placeholder="99123456"
                value={nationalNumber}
                onChange={(e) => setNationalNumber(e.target.value.replace(/\D/g, '').slice(0, 15))}
              />
            </div>
          </div>

          <label className="ca-auth__label">
            Email
            <input
              className="ca-auth__input"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>

          <div className="ca-auth__field">
            <label className="ca-auth__label" htmlFor="register-password">
              Contraseña
            </label>
            <PasswordInput
              id="register-password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-describedby="register-password-reqs"
            />
            <div id="register-password-reqs">
              <PasswordRequirementsList password={password} />
            </div>
          </div>

          <div className="ca-auth__field">
            <label className="ca-auth__label" htmlFor="register-password-confirm">
              Confirmar contraseña
            </label>
            <PasswordInput
              id="register-password-confirm"
              autoComplete="new-password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              aria-invalid={confirmMismatch || undefined}
              aria-describedby={
                confirmMismatch || passwordsMatch ? 'register-password-match' : undefined
              }
            />
            {confirmMismatch ? (
              <p id="register-password-match" className="ca-auth__hint ca-auth__hint--error">
                Las contraseñas no coinciden
              </p>
            ) : null}
            {passwordsMatch ? (
              <p id="register-password-match" className="ca-auth__hint ca-auth__hint--ok">
                Las contraseñas coinciden
              </p>
            ) : null}
          </div>

          <label className="ca-auth__check">
            <input
              type="checkbox"
              name="accept-terms"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              required
            />
            <span>
              Acepto los{' '}
              <Link
                to={`/terminos?volver=${encodeURIComponent(`/registro?next=${encodeURIComponent(next)}`)}`}
                className="ca-auth__check-link"
                target="_blank"
                rel="noopener noreferrer"
              >
                Términos y Condiciones
              </Link>
            </span>
          </label>

          <button className="ca-auth__submit ca-auth__submit--block" type="submit" disabled={loading}>
            {loading ? 'Creando…' : 'Crear cuenta gratis'}
          </button>
        </form>

        <p className="ca-auth__footer">
          ¿Ya tenés cuenta? <Link to={`/ingresar?next=${encodeURIComponent(next)}`}>Ingresar</Link>
        </p>
      </div>
    </div>
  );
}
