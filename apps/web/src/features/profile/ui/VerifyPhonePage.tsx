import { useEffect, useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent } from 'react';
import { Button, Form } from 'react-bootstrap';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Smartphone } from 'lucide-react';

import { setLocalVerifiedPhone } from '../model/phone-verification';

import '../styles/profile.css';

const CODE_LENGTH = 6;
const RESEND_SECONDS = 120;

type VerifyPhoneLocationState = {
  phone?: string;
};

function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/** Stub de verificación de teléfono por código OTP (sin envío real). */
export function VerifyPhonePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const phone = (location.state as VerifyPhoneLocationState | null)?.phone?.trim() || null;

  const [digits, setDigits] = useState<string[]>(() => Array(CODE_LENGTH).fill(''));
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = window.setTimeout(() => {
      setSecondsLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [secondsLeft]);

  const code = digits.join('');
  const canVerify = code.length === CODE_LENGTH;
  const canResend = secondsLeft === 0;

  const focusDigit = (index: number) => {
    inputsRef.current[index]?.focus();
    inputsRef.current[index]?.select();
  };

  const updateDigit = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    setDigits((prev) => {
      const next = [...prev];
      next[index] = digit;
      return next;
    });
    if (digit && index < CODE_LENGTH - 1) {
      focusDigit(index + 1);
    }
  };

  const onDigitKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      event.preventDefault();
      focusDigit(index - 1);
    }
    if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      focusDigit(index - 1);
    }
    if (event.key === 'ArrowRight' && index < CODE_LENGTH - 1) {
      event.preventDefault();
      focusDigit(index + 1);
    }
  };

  const onDigitPaste = (event: ClipboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    event.preventDefault();
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, CODE_LENGTH);
    if (!pasted) return;
    const next = Array(CODE_LENGTH).fill('');
    pasted.split('').forEach((char, i) => {
      next[i] = char;
    });
    setDigits(next);
    focusDigit(Math.min(pasted.length, CODE_LENGTH - 1));
  };

  const onVerify = (event: FormEvent) => {
    event.preventDefault();
    // Stub: no hay envío al backend; solo marca el número como verificado en esta sesión.
    if (!canVerify) return;
    if (phone) setLocalVerifiedPhone(phone);
    navigate('/perfil?tab=settings');
  };

  const onResend = () => {
    if (!canResend) return;
    // Stub: no se envía ningún código todavía.
    setSecondsLeft(RESEND_SECONDS);
  };

  return (
    <div className="ca-verify-phone">
      <header className="ca-verify-phone__header">
        <button
          type="button"
          className="ca-verify-phone__back"
          onClick={() => navigate('/perfil?tab=settings')}
          aria-label="Volver a editar perfil"
        >
          <ArrowLeft size={18} strokeWidth={1.75} aria-hidden />
          Volver
        </button>
        <div className="ca-verify-phone__intro">
          <span className="ca-verify-phone__icon" aria-hidden>
            <Smartphone size={22} strokeWidth={1.75} />
          </span>
          <div>
            <p className="ca-verify-phone__kicker">Teléfono</p>
            <h1 className="ca-verify-phone__title">Verificar número</h1>
            <p className="ca-verify-phone__lead">
              Ingresá el código de 6 dígitos
              {phone ? (
                <>
                  {' '}
                  enviado a <strong>{phone}</strong>
                </>
              ) : null}
              .
            </p>
          </div>
        </div>
      </header>

      <section className="ca-verify-phone__card">
        <Form onSubmit={onVerify} className="ca-verify-phone__form">
          <Form.Label id="verify-phone-code-label" className="ca-verify-phone__label">
            Código de verificación
          </Form.Label>
          <div
            className="ca-verify-phone__otp"
            role="group"
            aria-labelledby="verify-phone-code-label"
          >
            {digits.map((digit, index) => (
              <Form.Control
                key={index}
                ref={(el) => {
                  inputsRef.current[index] = el;
                }}
                type="text"
                inputMode="numeric"
                autoComplete={index === 0 ? 'one-time-code' : 'off'}
                maxLength={1}
                value={digit}
                className="ca-verify-phone__digit"
                aria-label={`Dígito ${index + 1} de ${CODE_LENGTH}`}
                onChange={(event) => updateDigit(index, event.target.value)}
                onKeyDown={(event) => onDigitKeyDown(index, event)}
                onPaste={onDigitPaste}
              />
            ))}
          </div>

          <div className="ca-form-actions ca-verify-phone__actions">
            <Button type="submit" className="ca-btn-cta" disabled={!canVerify}>
              Verificar
            </Button>
            <Button type="button" variant="outline-secondary" disabled={!canResend} onClick={onResend}>
              {canResend
                ? 'Enviar código nuevamente'
                : `Enviar código nuevamente (${formatCountdown(secondsLeft)})`}
            </Button>
          </div>
        </Form>

        <p className="ca-verify-phone__footer">
          <Link to="/perfil?tab=settings">Volver a Mi perfil</Link>
        </p>
      </section>
    </div>
  );
}
