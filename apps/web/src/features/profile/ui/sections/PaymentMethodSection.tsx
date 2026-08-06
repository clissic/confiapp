import { Alert, Button, Form, InputGroup, OverlayTrigger, Popover } from 'react-bootstrap';
import { useEffect, useMemo, useState } from 'react';
import { CircleHelp, Landmark, Trash2 } from 'lucide-react';

import { useZodForm } from '@/shared/lib/form';
import { useAppToast } from '@/shared/ui';

import { useUpdateProfile } from '../../hooks/useProfile';
import {
  formatPayoutMethodType,
  getPayoutBankHelp,
  isFintechBank,
  PAYOUT_ACCOUNT_KIND_OPTIONS,
  PAYOUT_BANK_OPTIONS,
  PAYOUT_CURRENCY_OPTIONS,
  sanitizePayoutAccountNumber,
} from '../../model/payout-methods';
import { payoutMethodFormSchema, type PayoutMethodFormValues } from '../../model/schemas';
import type { ProfilePayoutMethod, UserProfile } from '../../model/types';
import { MaskedAccountNumber } from '../MaskedAccountNumber';

export function PaymentMethodSection({ profile }: { profile: UserProfile }) {
  const update = useUpdateProfile();
  const toast = useAppToast();
  const [methods, setMethods] = useState<ProfilePayoutMethod[]>(profile.payoutMethods ?? []);

  const form = useZodForm(payoutMethodFormSchema, {
    defaultValues: {
      bank: '',
      number: '',
      type: 'CA',
      currency: 'UYU',
    },
  });

  useEffect(() => {
    setMethods(profile.payoutMethods ?? []);
  }, [profile]);

  const selectedBank = form.watch('bank');
  const fintech = isFintechBank(selectedBank);
  const helpText = useMemo(() => getPayoutBankHelp(selectedBank), [selectedBank]);

  useEffect(() => {
    if (!selectedBank) return;
    if (isFintechBank(selectedBank)) {
      form.setValue('type', 'FINTECH', { shouldValidate: true });
      form.setValue('currency', '', { shouldValidate: true });
    } else if (form.getValues('type') === 'FINTECH') {
      form.setValue('type', 'CA', { shouldValidate: true });
      form.setValue('currency', 'UYU', { shouldValidate: true });
    }
  }, [selectedBank, form]);

  const persist = async (next: ProfilePayoutMethod[], message: string) => {
    await update.mutateAsync({
      payoutMethods: next.map((method) => ({
        id: method.id,
        bank: method.bank,
        number: method.number,
        type: method.type,
        currency: method.currency,
        createdAt: method.createdAt,
      })),
    });
    setMethods(next);
    toast.success(message);
  };

  const onSubmit = form.handleSubmit(async (values: PayoutMethodFormValues) => {
    const nextMethod: ProfilePayoutMethod = {
      id: `local-${Date.now()}`,
      bank: values.bank,
      number: values.number,
      type: fintech ? 'FINTECH' : values.type,
      currency: fintech ? '' : values.currency,
      createdAt: new Date().toISOString(),
    };
    await persist([...methods, nextMethod], 'Método de cobro agregado.');
    form.reset({
      bank: '',
      number: '',
      type: 'CA',
      currency: 'UYU',
    });
  });

  const onRemove = async (id: string) => {
    await persist(
      methods.filter((method) => method.id !== id),
      'Método de cobro eliminado.',
    );
  };

  const helpPopover = (
    <Popover id="payout-bank-help" className="ca-payout-popover">
      <Popover.Header as="h4">Formato de cuenta</Popover.Header>
      <Popover.Body>{helpText}</Popover.Body>
    </Popover>
  );

  return (
    <section id="metodo-cobro" className="ca-payout">
      <h3 className="ca-section-title">
        <Landmark size={22} strokeWidth={1.75} aria-hidden />
        Agregar método de cobro
      </h3>
      <p className="ca-section-lead">
        Cuentas bancarias y billeteras electrónicas para recibir pagos y retiros. Es importante que
        los datos sean correctos.
      </p>

      {update.isError ? <Alert variant="danger">No se pudo guardar el método de cobro.</Alert> : null}

      <Form onSubmit={onSubmit} className="ca-payout__form">
        <div className="row g-3">
          <Form.Group className="col-12 col-md-6 col-lg-3" controlId="payout-bank">
            <Form.Label>Banco o billetera</Form.Label>
            <Form.Select
              {...form.register('bank')}
              isInvalid={Boolean(form.formState.errors.bank)}
            >
              <option value="">Seleccione un banco</option>
              {PAYOUT_BANK_OPTIONS.map((bank) => (
                <option key={bank} value={bank}>
                  {bank}
                </option>
              ))}
            </Form.Select>
            <Form.Control.Feedback type="invalid">
              {form.formState.errors.bank?.message}
            </Form.Control.Feedback>
          </Form.Group>

          <Form.Group className="col-12 col-md-6 col-lg-3" controlId="payout-number">
            <Form.Label>Número de cuenta</Form.Label>
            <InputGroup hasValidation>
              <Form.Control
                value={form.watch('number')}
                onChange={(event) => {
                  form.setValue('number', sanitizePayoutAccountNumber(event.target.value), {
                    shouldDirty: true,
                    shouldValidate: true,
                  });
                }}
                onBlur={() => void form.trigger('number')}
                inputMode="numeric"
                autoComplete="off"
                placeholder={selectedBank ? 'Solo dígitos' : 'Elegí un banco primero'}
                disabled={!selectedBank}
                isInvalid={Boolean(form.formState.errors.number)}
              />
              <InputGroup.Text className="ca-payout__help">
                {helpText ? (
                  <OverlayTrigger
                    trigger={['hover', 'focus', 'click']}
                    placement="top"
                    overlay={helpPopover}
                  >
                    <button type="button" className="ca-payout__help-btn" aria-label="Ayuda de formato">
                      <CircleHelp size={16} strokeWidth={1.75} />
                    </button>
                  </OverlayTrigger>
                ) : (
                  <CircleHelp size={16} strokeWidth={1.75} className="text-muted" aria-hidden />
                )}
              </InputGroup.Text>
              <Form.Control.Feedback type="invalid">
                {form.formState.errors.number?.message}
              </Form.Control.Feedback>
            </InputGroup>
            {helpText ? <p className="ca-payout__hint mb-0 mt-1 d-md-none">{helpText}</p> : null}
          </Form.Group>

          <Form.Group className="col-12 col-md-6 col-lg-3" controlId="payout-type">
            <Form.Label>Tipo de cuenta</Form.Label>
            <Form.Select
              {...form.register('type')}
              disabled={fintech || !selectedBank}
              isInvalid={Boolean(form.formState.errors.type)}
            >
              {fintech ? (
                <option value="FINTECH">FINTECH</option>
              ) : (
                <>
                  <option value="">Tipo</option>
                  {PAYOUT_ACCOUNT_KIND_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </>
              )}
            </Form.Select>
            <Form.Control.Feedback type="invalid">
              {form.formState.errors.type?.message}
            </Form.Control.Feedback>
          </Form.Group>

          <Form.Group className="col-12 col-md-6 col-lg-3" controlId="payout-currency">
            <Form.Label>Moneda</Form.Label>
            <Form.Select
              {...form.register('currency')}
              disabled={fintech || !selectedBank}
              isInvalid={Boolean(form.formState.errors.currency)}
            >
              {fintech ? (
                <option value="">—</option>
              ) : (
                <>
                  <option value="">Moneda</option>
                  {PAYOUT_CURRENCY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </>
              )}
            </Form.Select>
            <Form.Control.Feedback type="invalid">
              {form.formState.errors.currency?.message}
            </Form.Control.Feedback>
          </Form.Group>

          <div className="col-12 ca-form-actions">
            <Button type="submit" className="ca-btn-cta" disabled={update.isPending || !selectedBank}>
              {update.isPending ? 'Guardando…' : 'Agregar método'}
            </Button>
          </div>
        </div>
      </Form>

      {methods.length > 0 ? (
        <ul className="ca-payout__list">
          {methods.map((method) => (
            <li key={method.id} className="ca-payout__item">
              <div className="ca-payout__item-main">
                <strong>{method.bank}</strong>
                <span className="ca-payout__item-meta">{formatPayoutMethodType(method)}</span>
                <span className="ca-payout__item-number">
                  <MaskedAccountNumber number={method.number} />
                </span>
              </div>
              <Button
                type="button"
                variant="outline-danger"
                size="sm"
                className="ca-payout__remove"
                disabled={update.isPending}
                onClick={() => void onRemove(method.id)}
                aria-label={`Eliminar ${method.bank}`}
              >
                <Trash2 size={16} strokeWidth={1.75} />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="ca-payout__empty">Todavía no cargaste métodos de cobro.</p>
      )}
    </section>
  );
}
