import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { resetPasswordRequest } from '../api/auth.api';
import { isStrongPassword } from '../lib/password';
import { AuthBrand } from './AuthBrand';
import { PasswordInput } from './PasswordInput';
import { PasswordRequirementsList } from './PasswordRequirementsList';
import '../styles/auth.css';

/** Nueva contraseña desde el enlace del email (token en query). */
export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token')?.trim() ?? '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const confirmMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  useEffect(() => {
    if (!success) return;
    const id = window.setTimeout(() => {
      navigate('/ingresar', { replace: true });
    }, 1800);
    return () => window.clearTimeout(id);
  }, [success, navigate]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!token) {
      setError('El enlace es inválido o está incompleto.');
      return;
    }
    if (!isStrongPassword(password)) {
      setError('La contraseña no cumple los requisitos de seguridad.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setLoading(true);
    try {
      const result = await resetPasswordRequest(token, password);
      setSuccess(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo restablecer la contraseña.');
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="ca-auth">
        <div className="ca-auth__card">
          <AuthBrand />
          <h1 className="ca-auth__title">Enlace inválido</h1>
          <p className="ca-auth__lead">
            Este enlace no incluye un token válido. Pedí uno nuevo desde recuperar contraseña.
          </p>
          <p className="ca-auth__footer">
            <Link to="/recuperar-contrasena">Recuperar contraseña</Link>
            {' · '}
            <Link to="/ingresar">Ingresar</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="ca-auth">
      <div className="ca-auth__card">
        <AuthBrand />
        <h1 className="ca-auth__title">Nueva contraseña</h1>
        <p className="ca-auth__lead">Elegí una contraseña nueva para tu cuenta.</p>

        {success ? (
          <>
            <p className="ca-auth__hint ca-auth__hint--ok">{success} Te llevamos al ingreso…</p>
            <p className="ca-auth__footer">
              <Link to="/ingresar">Ir a ingresar ahora</Link>
            </p>
          </>
        ) : (
          <>
            <form className="ca-auth__form" onSubmit={onSubmit} noValidate>
              {error ? <p className="ca-auth__error">{error}</p> : null}

              <div className="ca-auth__field">
                <label className="ca-auth__label" htmlFor="reset-password">
                  Nueva contraseña
                </label>
                <PasswordInput
                  id="reset-password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-describedby="reset-password-reqs"
                  disabled={loading}
                />
                <div id="reset-password-reqs">
                  <PasswordRequirementsList password={password} />
                </div>
              </div>

              <div className="ca-auth__field">
                <label className="ca-auth__label" htmlFor="reset-password-confirm">
                  Confirmar contraseña
                </label>
                <PasswordInput
                  id="reset-password-confirm"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  aria-invalid={confirmMismatch || undefined}
                  disabled={loading}
                />
                {confirmMismatch ? (
                  <p className="ca-auth__hint ca-auth__hint--error">Las contraseñas no coinciden.</p>
                ) : null}
                {passwordsMatch ? (
                  <p className="ca-auth__hint ca-auth__hint--ok">Las contraseñas coinciden.</p>
                ) : null}
              </div>

              <button
                className="ca-auth__submit"
                type="submit"
                disabled={loading || !isStrongPassword(password) || !passwordsMatch}
              >
                {loading ? 'Guardando…' : 'Cambiar contraseña'}
              </button>
            </form>

            <p className="ca-auth__footer">
              <Link to="/ingresar">Volver a ingresar</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
