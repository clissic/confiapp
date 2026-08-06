import { Badge, Button, Form } from 'react-bootstrap';
import { Controller } from 'react-hook-form';
import { useEffect } from 'react';

import { useZodForm } from '@/shared/lib/form';
import { useAppToast } from '@/shared/ui';

import { useUpdateProfile } from '../../hooks/useProfile';
import { composePhoneNumber, splitPhoneNumber } from '../../model/country-dial-codes';
import { phoneFormSchema, type PhoneFormValues } from '../../model/schemas';
import type { UserProfile } from '../../model/types';
import { CountryDialSelect } from './CountryDialSelect';

export function PhoneSection({ profile }: { profile: UserProfile }) {
  const update = useUpdateProfile();
  const toast = useAppToast();

  const form = useZodForm(phoneFormSchema, {
    defaultValues: splitPhoneNumber(profile.phone),
  });

  useEffect(() => {
    form.reset(splitPhoneNumber(profile.phone));
  }, [profile, form]);

  const onSubmit = form.handleSubmit(async (values: PhoneFormValues) => {
    const phone = composePhoneNumber(values.countryIso, values.nationalNumber);
    await update.mutateAsync({ phone });
    toast.success('Teléfono actualizado.');
  });

  const nationalNumberField = form.register('nationalNumber');

  return (
    <section>
      <h3 className="ca-section-title ca-section-title--inline">
        Teléfono{' '}
        {profile.phoneVerified ? (
          <Badge className="ca-badge-positive">Verificado</Badge>
        ) : (
          <Badge bg="warning" text="dark">
            Sin verificar
          </Badge>
        )}
      </h3>
      <p className="ca-section-lead">Número de contacto asociado a tu cuenta.</p>

      <Form onSubmit={onSubmit}>
        <Form.Group controlId="phone">
          <Form.Label>Teléfono</Form.Label>
          <div className="ca-phone-field row g-2 align-items-stretch">
            <div className="col-4 col-md-auto">
              <Controller
                name="countryIso"
                control={form.control}
                render={({ field }) => (
                  <CountryDialSelect
                    id="phone-country"
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    invalid={Boolean(form.formState.errors.countryIso)}
                  />
                )}
              />
            </div>
            <div className="col-8 col-md-5 col-lg-3">
              <Form.Control
                className="ca-phone-field__number"
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                placeholder="91234567"
                name={nationalNumberField.name}
                ref={nationalNumberField.ref}
                onBlur={nationalNumberField.onBlur}
                onChange={(event) => {
                  event.target.value = event.target.value.replace(/\D/g, '');
                  void nationalNumberField.onChange(event);
                }}
                isInvalid={Boolean(form.formState.errors.nationalNumber)}
              />
            </div>
            <div className="col-12 col-md-auto">
              <Button
                type="submit"
                className="ca-btn-cta ca-phone-field__save"
                disabled={update.isPending}
              >
                {update.isPending ? 'Guardando…' : 'Guardar'}
              </Button>
            </div>
          </div>
          <Form.Control.Feedback type="invalid" className="d-block">
            {form.formState.errors.countryIso?.message ||
              form.formState.errors.nationalNumber?.message}
          </Form.Control.Feedback>
          <Form.Text>Elegí el país por su bandera y escribí solo el número.</Form.Text>
        </Form.Group>
      </Form>
    </section>
  );
}
