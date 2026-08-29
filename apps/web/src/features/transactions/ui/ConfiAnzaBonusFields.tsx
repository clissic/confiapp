import { Accordion, Form } from 'react-bootstrap';
import type { FieldError, FieldValues, Path, UseFormRegister } from 'react-hook-form';

import { PAYMENT_CURRENCY_OPTIONS } from '@/shared/lib/money';

export function ConfiAnzaMark({ className = '' }: { className?: string }) {
  return (
    <span className={['ca-tx-confianza-mark', className].filter(Boolean).join(' ')}>
      <span className="ca-tx-confianza-mark__confi">Confi</span>
      <span className="ca-tx-confianza-mark__anza">Anza</span>
    </span>
  );
}

type ConfiAnzaFormFields = {
  confiAnzaAmount?: number | string;
  confiAnzaCurrency?: string;
};

type ConfiAnzaBonusFieldsProps<T extends FieldValues & ConfiAnzaFormFields> = {
  controlIdPrefix: string;
  register: UseFormRegister<T>;
  amountError?: FieldError;
  disabled?: boolean;
};

/** Acordeón opcional: tip ConfiAnza que paga siempre quien crea la operación. */
export function ConfiAnzaBonusFields<T extends FieldValues & ConfiAnzaFormFields>({
  controlIdPrefix,
  register,
  amountError,
  disabled,
}: ConfiAnzaBonusFieldsProps<T>) {
  return (
    <Accordion className="ca-tx-confianza" defaultActiveKey="">
      <Accordion.Item eventKey="bonus" className="ca-tx-confianza__item">
        <Accordion.Header>
          <span className="ca-tx-confianza__title">
            Suma <ConfiAnzaMark />
          </span>
        </Accordion.Header>
        <Accordion.Body>
          <p className="ca-tx-confianza__lead">
            El sistema de <ConfiAnzaMark /> motiva a los Agentes a aceptar tus viajes con mayor
            interés y así completar las transacciones con más rapidez.
          </p>

          <div className="ca-tx-start-grid ca-tx-start-grid--price">
            <Form.Group controlId={`${controlIdPrefix}-confianza-amount`}>
              <Form.Label>
                Monto <ConfiAnzaMark />
              </Form.Label>
              <Form.Control
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                placeholder="0"
                disabled={disabled}
                isInvalid={Boolean(amountError)}
                {...register('confiAnzaAmount' as Path<T>)}
              />
              <Form.Control.Feedback type="invalid">
                {amountError?.message}
              </Form.Control.Feedback>
            </Form.Group>

            <Form.Group controlId={`${controlIdPrefix}-confianza-currency`}>
              <Form.Label>Moneda</Form.Label>
              <Form.Select disabled={disabled} {...register('confiAnzaCurrency' as Path<T>)}>
                {PAYMENT_CURRENCY_OPTIONS.map((option) => (
                  <option key={option.code} value={option.code} disabled={option.disabled}>
                    {option.label}
                    {option.disabled ? ' (próximamente)' : ''}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
          </div>

          <p className="ca-tx-confianza__payer-hint">
            Este monto lo pagás vos como creador de la operación, siempre.
          </p>
        </Accordion.Body>
      </Accordion.Item>
    </Accordion>
  );
}
