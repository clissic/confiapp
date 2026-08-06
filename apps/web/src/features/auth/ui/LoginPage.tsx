import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';

import { loginRequest } from '../api/auth.api';
import { ApiClientError } from '@/shared/api/client';
import { AuthBrand } from './AuthBrand';
import { useAuth } from './AuthProvider';
import { PasswordInput } from './PasswordInput';
import '../styles/auth.css';

function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/inicio';
  if (raw === '/' || raw === '/ingresar' || raw === '/registro') return '/inicio';
  return raw;
}

/** Pantalla de acceso a la plataforma. */
export function LoginPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNextPath(params.get('next'));
  const { setSession, isAuthenticated, isBootstrapping } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNeedsVerification(false);
    setLoading(true);
    try {
      const session = await loginRequest(email.trim(), password);
      setSession(session);
      navigate(next, { replace: true });
    } catch (err) {
      if (err instanceof ApiClientError && err.code === 'EMAIL_NOT_VERIFIED') {
        setNeedsVerification(true);
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión');
      }
    } finally {
      setLoading(false);
    }
  }

  if (!isBootstrapping && isAuthenticated) {
    return <Navigate to={next} replace />;
  }

  return (
    <div className="ca-auth">
      <div className="ca-auth__card">
        <AuthBrand />
        <h1 className="ca-auth__title">Ingresar</h1>
        <p className="ca-auth__lead">
          Accedé a tu cuenta para comprar, vender o mediar entregas como Agente.
        </p>

        <form className="ca-auth__form" onSubmit={onSubmit} noValidate>
          {error ? <p className="ca-auth__error">{error}</p> : null}
          {needsVerification ? (
            <p className="ca-auth__hint">
              <Link
                to={`/verificar-email?email=${encodeURIComponent(email.trim())}&next=${encodeURIComponent(next)}`}
              >
                Reenviar email de confirmación
              </Link>
            </p>
          ) : null}

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

          <label className="ca-auth__label">
            Contraseña
            <PasswordInput
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          <button className="ca-auth__submit" type="submit" disabled={loading}>
            {loading ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>

        <p className="ca-auth__footer">
          ¿No tenés cuenta? <Link to={`/registro?next=${encodeURIComponent(next)}`}>Crear cuenta</Link>
        </p>
      </div>
    </div>
  );
}
