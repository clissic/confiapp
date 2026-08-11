import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Mail, Sparkles } from 'lucide-react';

import { resendVerificationRequest, verifyEmailRequest } from '../api/auth.api';
import { AuthBrand } from './AuthBrand';
import '../styles/auth.css';

type Phase = 'pending' | 'verifying' | 'success' | 'error';

function friendlyVerifyMessage(raw?: string | null): string {
  const value = (raw ?? '').trim();
  if (!value || /email verified successfully/i.test(value)) {
    return 'Tu cuenta ya está activa. Ingresá y empezá a operar con tranquilidad.';
  }
  return value;
}

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
        setMessage(friendlyVerifyMessage(result.message));
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

  const loginHref = `/ingresar?next=${encodeURIComponent(next)}`;

  return (
    <div className="ca-auth">
      <div className={`ca-auth__card${phase === 'success' ? ' ca-auth__card--status' : ''}`}>
        <div className={phase === 'success' ? 'ca-auth__brand-wrap' : undefined}>
          <AuthBrand />
        </div>

        {phase === 'success' ? (
          <div className="ca-auth__status">
            <div className="ca-auth__status-icon ca-auth__status-icon--ok" aria-hidden>
              <CheckCircle2 size={32} strokeWidth={1.75} />
            </div>
            <p className="ca-auth__eyebrow">
              <Sparkles size={14} strokeWidth={2} aria-hidden />
              Listo
            </p>
            <h1 className="ca-auth__title">Email confirmado</h1>
            <p className="ca-auth__lead">{friendlyVerifyMessage(message)}</p>
            <Link className="ca-auth__submit ca-auth__submit--block" to={loginHref}>
              Continuar a ingresar
            </Link>
          </div>
        ) : null}

        {phase === 'verifying' ? (
          <div className="ca-auth__status">
            <div className="ca-auth__status-icon ca-auth__status-icon--pulse" aria-hidden>
              <Mail size={28} strokeWidth={1.75} />
            </div>
            <h1 className="ca-auth__title">Confirmando…</h1>
            <p className="ca-auth__lead">Estamos verificando tu email. Un momento.</p>
          </div>
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
              <button className="ca-auth__submit ca-auth__submit--block" type="submit" disabled={resending}>
                {resending ? 'Reenviando…' : 'Reenviar email de confirmación'}
              </button>
            </form>
          </>
        ) : null}

        {phase !== 'success' ? (
          <p className="ca-auth__footer">
            <Link to={loginHref}>Volver a ingresar</Link>
          </p>
        ) : null}
      </div>
    </div>
  );
}
