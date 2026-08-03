import { Alert, Badge, Button, Form } from 'react-bootstrap';
import { useEffect, useState } from 'react';

import { useZodForm } from '@/shared/lib/form';

import { useUpdateProfile } from '../../hooks/useProfile';
import { phoneFormSchema, type PhoneFormValues } from '../../model/schemas';
import type { UserProfile } from '../../model/types';

export function PhoneSection({ profile }: { profile: UserProfile }) {
  const update = useUpdateProfile();
  const [feedback, setFeedback] = useState<string | null>(null);

  const form = useZodForm(phoneFormSchema, {
    defaultValues: { phone: profile.phone ?? '' },
  });

  useEffect(() => {
    form.reset({ phone: profile.phone ?? '' });
  }, [profile, form]);

  const onSubmit = form.handleSubmit(async (values: PhoneFormValues) => {
    setFeedback(null);
    await update.mutateAsync({ phone: values.phone });
    setFeedback('Teléfono actualizado.');
  });

  return (
    <section>
      <h3 className="ca-section-title">Teléfono</h3>
      <p className="ca-section-lead">Número de contacto asociado a tu cuenta.</p>

      <div className="mb-3">
        {profile.phoneVerified ? (
          <Badge className="ca-badge-positive">Verificado</Badge>
        ) : (
          <Badge bg="warning" text="dark">
            Sin verificar
          </Badge>
        )}
      </div>

      {feedback ? <Alert variant="success">{feedback}</Alert> : null}

      <Form onSubmit={onSubmit} className="ca-form-grid">
        <Form.Group controlId="phone">
          <Form.Label>Teléfono</Form.Label>
          <Form.Control
            {...form.register('phone')}
            placeholder="+54 9 11 0000-0000"
            isInvalid={Boolean(form.formState.errors.phone)}
          />
          <Form.Control.Feedback type="invalid">
            {form.formState.errors.phone?.message}
          </Form.Control.Feedback>
          <Form.Text>Formato internacional recomendado.</Form.Text>
        </Form.Group>

        <div className="ca-form-actions ca-form-grid__full">
          <Button type="submit" className="ca-btn-primary" disabled={update.isPending}>
            Guardar teléfono
          </Button>
        </div>
      </Form>
    </section>
  );
}
