import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { forgotPasswordRequest } from '../api/auth.api';
import { isRequestTimeoutError } from '@/shared/api/client';
import { AuthBrand } from './AuthBrand';
import '../styles/auth.css';

/** Solicitud de enlace para restablecer contraseña. */
export function ForgotPasswordPage() {
  const [params] = useSearchParams();
  const [email, setEmail] = useState(params.get('email')?.trim() ?? '');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setInfo(null);
    const mail = email.trim();
    if (!mail) {
      setError('Ingresá el email de tu cuenta.');
      return;
    }
    setLoading(true);
    try {
      const result = await forgotPasswordRequest(mail);
      setInfo(result.message);
    } catch (err) {
      if (isRequestTimeoutError(err)) {
        setInfo(
          'El envío está demorando, pero el email puede llegar igual. Revisá tu bandeja y spam en unos minutos.',
        );
      } else {
        setError(err instanceof Error ? err.message : 'No se pudo enviar el email.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="ca-auth">
      <div className="ca-auth__card">
        <AuthBrand />
        <h1 className="ca-auth__title">Recuperar contraseña</h1>
        <p className="ca-auth__lead">
          Ingresá el email de tu cuenta. Si existe, te enviamos un enlace válido por 15 minutos.
        </p>

        <form className="ca-auth__form" onSubmit={onSubmit} noValidate>
          {error ? <p className="ca-auth__error">{error}</p> : null}
          {info ? <p className="ca-auth__hint ca-auth__hint--ok">{info}</p> : null}

          <label className="ca-auth__label">
            Email
            <input
              className="ca-auth__input"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </label>

          <button className="ca-auth__submit" type="submit" disabled={loading}>
            {loading ? 'Enviando…' : 'Enviar enlace'}
          </button>
        </form>

        <p className="ca-auth__footer">
          <Link to="/ingresar">Volver a ingresar</Link>
        </p>
      </div>
    </div>
  );
}
