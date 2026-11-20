import { useEffect, useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent } from 'react';
import { Alert, Button, Form } from 'react-bootstrap';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Construction, Smartphone } from 'lucide-react';

import { useAuth } from '@/features/auth/ui/AuthProvider';
import { useAppToast } from '@/shared/ui';

import {
  PHONE_OTP_IN_IMPLEMENTATION,
  setLocalVerifiedPhone,
} from '../model/phone-verification';

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

/**
 * Verificación de teléfono por OTP.
 * Mientras `PHONE_OTP_IN_IMPLEMENTATION`: UI completa visible pero sin envío SMS ni validación real.
 * El desarrollo del flujo se conserva para cablear el proveedor.
 */
export function VerifyPhonePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useAppToast();
  const { user } = useAuth();
  const phone = (location.state as VerifyPhoneLocationState | null)?.phone?.trim() || null;
  const inImplementation = PHONE_OTP_IN_IMPLEMENTATION;

  const [digits, setDigits] = useState<string[]>(() => Array(CODE_LENGTH).fill(''));
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (inImplementation || secondsLeft <= 0) return;
    const timer = window.setTimeout(() => {
      setSecondsLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [inImplementation, secondsLeft]);

  const code = digits.join('');
  const canVerify = !inImplementation && code.length === CODE_LENGTH;
  const canResend = !inImplementation && secondsLeft === 0;

  const focusDigit = (index: number) => {
    if (inImplementation) return;
    inputsRef.current[index]?.focus();
    inputsRef.current[index]?.select();
  };

  const updateDigit = (index: number, value: string) => {
    if (inImplementation) return;
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
    if (inImplementation) return;
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
    if (inImplementation) {
      event.preventDefault();
      return;
    }
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
    if (inImplementation) {
      showToast(
        'La verificación por SMS está en implementación. Pronto vas a poder confirmar tu número.',
        { variant: 'info' },
      );
      return;
    }
    // Flujo listo: cuando haya proveedor, validar OTP en API y luego marcar verificado.
    if (!canVerify) return;
    if (phone && user?.id) setLocalVerifiedPhone(user.id, phone);
    navigate('/perfil?tab=settings');
  };

  const onResend = () => {
    if (inImplementation) {
      showToast(
        'Todavía no enviamos SMS. La verificación de teléfono está en implementación.',
        { variant: 'info' },
      );
      return;
    }
    if (!canResend) return;
    // Flujo listo: llamar al endpoint de reenvío cuando exista.
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
              {inImplementation
                ? 'Estamos implementando el envío de un código por SMS para confirmar tu número.'
                : (
                  <>
                    Ingresá el código de 6 dígitos
                    {phone ? (
                      <>
                        {' '}
                        enviado a <strong>{phone}</strong>
                      </>
                    ) : null}
                    .
                  </>
                )}
            </p>
          </div>
        </div>
      </header>

      <section className="ca-verify-phone__card">
        {inImplementation ? (
          <Alert variant="info" className="ca-verify-phone__wip mb-0">
            <div className="ca-verify-phone__wip-head">
              <Construction size={18} strokeWidth={1.75} aria-hidden />
              <strong>En implementación</strong>
            </div>
            <p className="mb-0">
              Todavía no hay un servicio de SMS configurado. La pantalla de verificación ya está
              lista y se activará cuando conectemos el proveedor. Mientras tanto podés guardar tu
              teléfono en el perfil; la marca “verificado” llegará con esta función.
            </p>
          </Alert>
        ) : null}

        <Form
          onSubmit={onVerify}
          className={`ca-verify-phone__form${inImplementation ? ' ca-verify-phone__form--wip' : ''}`}
          aria-disabled={inImplementation}
        >
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
                disabled={inImplementation}
                onChange={(event) => updateDigit(index, event.target.value)}
                onKeyDown={(event) => onDigitKeyDown(index, event)}
                onPaste={onDigitPaste}
              />
            ))}
          </div>

          <div className="ca-form-actions ca-verify-phone__actions">
            <Button type="submit" className="ca-btn-cta" disabled={!canVerify}>
              {inImplementation ? 'Próximamente' : 'Verificar'}
            </Button>
            <Button
              type="button"
              variant="outline-secondary"
              disabled={!canResend}
              onClick={onResend}
            >
              {inImplementation
                ? 'Reenvío de SMS próximamente'
                : canResend
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
