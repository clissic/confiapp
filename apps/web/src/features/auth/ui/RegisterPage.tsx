import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';

import { registerRequest } from '../api/auth.api';
import { isStrongPassword, PASSWORD_HINT } from '../lib/password';
import { AuthBrand } from './AuthBrand';
import { useAuth } from './AuthProvider';
import { PasswordInput } from './PasswordInput';
import '../styles/auth.css';

function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/inicio';
  if (raw === '/' || raw === '/ingresar' || raw === '/registro') return '/inicio';
  return raw;
}

/** Alta de cuenta — requiere confirmación de email antes de ingresar. */
export function RegisterPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNextPath(params.get('next'));
  const { isAuthenticated, isBootstrapping } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const name = fullName.trim();
    const mail = email.trim();

    if (name.length < 2) {
      setError('El nombre debe tener al menos 2 caracteres.');
      return;
    }
    if (!isStrongPassword(password)) {
      setError(PASSWORD_HINT);
      return;
    }

    setLoading(true);
    try {
      await registerRequest({
        email: mail,
        password,
        fullName: name,
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
              autoComplete="name"
              required
              minLength={2}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </label>

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
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <span className="ca-auth__hint">{PASSWORD_HINT}</span>
          </label>

          <button className="ca-auth__submit" type="submit" disabled={loading}>
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
