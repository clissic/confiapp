import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Mail } from 'lucide-react';

import { resendVerificationRequest, verifyEmailRequest } from '../api/auth.api';
import { AuthBrand } from './AuthBrand';
import '../styles/auth.css';

type Phase = 'pending' | 'verifying' | 'success' | 'error';

/** Confirmación de email (link del mail o pantalla post-registro). */
export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token')?.trim() ?? '';
  const emailFromQuery = params.get('email')?.trim() ?? '';
  const next = params.get('next') ?? '/inicio';

  const [phase, setPhase] = useState<Phase>(token ? 'verifying' : 'pending');
  const [message, setMessage] = useState<string | null>(null);
  const [email, setEmail] = useState(emailFromQuery);
  const [resending, setResending] = useState(false);
  const [resendInfo, setResendInfo] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    (async () => {
      try {
        const result = await verifyEmailRequest(token);
        if (cancelled) return;
        setPhase('success');
        setMessage(result.message || 'Email confirmado. Ya podés ingresar.');
      } catch (err) {
        if (cancelled) return;
        setPhase('error');
        setMessage(err instanceof Error ? err.message : 'No se pudo verificar el email.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  async function onResend(event: FormEvent) {
    event.preventDefault();
    setResendInfo(null);
    const mail = email.trim();
    if (!mail) {
      setResendInfo('Ingresá el email de tu cuenta.');
      return;
    }
    setResending(true);
    try {
      const result = await resendVerificationRequest(mail);
      setResendInfo(result.message);
    } catch (err) {
      setResendInfo(err instanceof Error ? err.message : 'No se pudo reenviar el email.');
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="ca-auth">
      <div className="ca-auth__card">
        <AuthBrand />

        {phase === 'success' ? (
          <>
            <div className="ca-auth__status-icon ca-auth__status-icon--ok" aria-hidden>
              <CheckCircle2 size={28} strokeWidth={1.75} />
            </div>
            <h1 className="ca-auth__title">Email confirmado</h1>
            <p className="ca-auth__lead">{message}</p>
            <Link
              className="ca-auth__submit"
              to={`/ingresar?next=${encodeURIComponent(next)}`}
              style={{ textAlign: 'center', textDecoration: 'none' }}
            >
              Ir a ingresar
            </Link>
          </>
        ) : null}

        {phase === 'verifying' ? (
          <>
            <h1 className="ca-auth__title">Confirmando…</h1>
            <p className="ca-auth__lead">Estamos verificando tu email. Un momento.</p>
          </>
        ) : null}

        {phase === 'error' ? (
          <>
            <h1 className="ca-auth__title">No se pudo confirmar</h1>
            <p className="ca-auth__error">{message}</p>
            <p className="ca-auth__lead">Pedí un enlace nuevo con el email de tu cuenta.</p>
          </>
        ) : null}

        {phase === 'pending' || phase === 'error' ? (
          <>
            {phase === 'pending' ? (
              <>
                <div className="ca-auth__status-icon" aria-hidden>
                  <Mail size={28} strokeWidth={1.75} />
                </div>
                <h1 className="ca-auth__title">Revisá tu email</h1>
                <p className="ca-auth__lead">
                  Te enviamos un enlace para confirmar tu cuenta
                  {emailFromQuery ? (
                    <>
                      {' '}
                      en <strong>{emailFromQuery}</strong>
                    </>
                  ) : null}
                  . Sin esa confirmación no podés ingresar.
                </p>
              </>
            ) : null}

            <form className="ca-auth__form" onSubmit={onResend}>
              {resendInfo ? <p className="ca-auth__hint">{resendInfo}</p> : null}
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
              <button className="ca-auth__submit" type="submit" disabled={resending}>
                {resending ? 'Reenviando…' : 'Reenviar email de confirmación'}
              </button>
            </form>
          </>
        ) : null}

        <p className="ca-auth__footer">
          <Link to={`/ingresar?next=${encodeURIComponent(next)}`}>Volver a ingresar</Link>
        </p>
      </div>
    </div>
  );
}
