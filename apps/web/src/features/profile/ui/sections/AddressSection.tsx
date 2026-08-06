import { Button, Form } from 'react-bootstrap';
import { useEffect } from 'react';

import { useZodForm } from '@/shared/lib/form';
import { useAppToast } from '@/shared/ui';

import { useUpdateProfile } from '../../hooks/useProfile';
import { addressFormSchema, type AddressFormValues } from '../../model/schemas';
import type { UserProfile } from '../../model/types';

export function AddressSection({ profile }: { profile: UserProfile }) {
  const update = useUpdateProfile();
  const toast = useAppToast();

  const form = useZodForm(addressFormSchema, {
    defaultValues: {
      line1: profile.address.line1 ?? '',
      line2: profile.address.line2 ?? '',
      city: profile.address.city ?? '',
      state: profile.address.state ?? '',
      country: profile.address.country ?? 'AR',
      postalCode: profile.address.postalCode ?? '',
      locationLabel: profile.locationLabel ?? '',
    },
  });

  useEffect(() => {
    form.reset({
      line1: profile.address.line1 ?? '',
      line2: profile.address.line2 ?? '',
      city: profile.address.city ?? '',
      state: profile.address.state ?? '',
      country: profile.address.country ?? 'AR',
      postalCode: profile.address.postalCode ?? '',
      locationLabel: profile.locationLabel ?? '',
    });
  }, [profile, form]);

  const onSubmit = form.handleSubmit(async (values: AddressFormValues) => {
    await update.mutateAsync({
      locationLabel: values.locationLabel || null,
      address: {
        line1: values.line1 || undefined,
        line2: values.line2 || undefined,
        city: values.city,
        state: values.state || undefined,
        country: values.country,
        postalCode: values.postalCode || undefined,
      },
    });
    toast.success('Dirección actualizada.');
  });

  return (
    <section>
      <h3 className="ca-section-title">Dirección</h3>
      <p className="ca-section-lead">
        Datos de ubicación para encuentros y cobertura. País en código ISO (AR, UY…).
      </p>

      <Form onSubmit={onSubmit} className="ca-form-grid">
        <Form.Group controlId="line1" className="ca-form-grid__full">
          <Form.Label>Calle y número</Form.Label>
          <Form.Control {...form.register('line1')} />
        </Form.Group>
        <Form.Group controlId="line2" className="ca-form-grid__full">
          <Form.Label>Piso / depto (opcional)</Form.Label>
          <Form.Control {...form.register('line2')} />
        </Form.Group>
        <Form.Group controlId="city">
          <Form.Label>Ciudad</Form.Label>
          <Form.Control
            {...form.register('city')}
            isInvalid={Boolean(form.formState.errors.city)}
          />
          <Form.Control.Feedback type="invalid">
            {form.formState.errors.city?.message}
          </Form.Control.Feedback>
        </Form.Group>
        <Form.Group controlId="state">
          <Form.Label>Provincia / estado</Form.Label>
          <Form.Control {...form.register('state')} />
        </Form.Group>
        <Form.Group controlId="country">
          <Form.Label>País</Form.Label>
          <Form.Control
            {...form.register('country')}
            isInvalid={Boolean(form.formState.errors.country)}
          />
          <Form.Control.Feedback type="invalid">
            {form.formState.errors.country?.message}
          </Form.Control.Feedback>
        </Form.Group>
        <Form.Group controlId="postalCode">
          <Form.Label>Código postal</Form.Label>
          <Form.Control {...form.register('postalCode')} />
        </Form.Group>
        <Form.Group controlId="locationLabel" className="ca-form-grid__full">
          <Form.Label>Etiqueta (barrio / zona)</Form.Label>
          <Form.Control {...form.register('locationLabel')} placeholder="Palermo, CABA" />
        </Form.Group>

        <div className="ca-form-actions ca-form-grid__full">
          <Button type="submit" className="ca-btn-cta" disabled={update.isPending}>
            Guardar dirección
          </Button>
        </div>
      </Form>
    </section>
  );
}
