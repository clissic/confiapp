import { Alert, Button, Form } from 'react-bootstrap';
import { useEffect, useState } from 'react';

import { useZodForm } from '@/shared/lib/form';

import { useUpdateProfile } from '../../hooks/useProfile';
import { editProfileSchema, type EditProfileValues } from '../../model/schemas';
import type { UserProfile } from '../../model/types';

export function EditProfileSection({ profile }: { profile: UserProfile }) {
  const update = useUpdateProfile();
  const [feedback, setFeedback] = useState<string | null>(null);

  const form = useZodForm(editProfileSchema, {
    defaultValues: {
      fullName: profile.fullName,
      displayName: profile.displayName ?? '',
      bio: profile.bio ?? '',
    },
  });

  useEffect(() => {
    form.reset({
      fullName: profile.fullName,
      displayName: profile.displayName ?? '',
      bio: profile.bio ?? '',
    });
  }, [profile, form]);

  const onSubmit = form.handleSubmit(async (values: EditProfileValues) => {
    setFeedback(null);
    await update.mutateAsync({
      fullName: values.fullName,
      displayName: values.displayName ?? null,
      bio: values.bio ?? null,
    });
    setFeedback('Perfil actualizado correctamente.');
  });

  return (
    <section>
      <h3 className="ca-section-title">Editar perfil</h3>
      <p className="ca-section-lead">Nombre, nombre público y biografía.</p>

      {feedback ? <Alert variant="success">{feedback}</Alert> : null}
      {update.isError ? <Alert variant="danger">No se pudo guardar.</Alert> : null}

      <Form onSubmit={onSubmit} className="ca-form-grid">
        <Form.Group controlId="fullName">
          <Form.Label>Nombre completo</Form.Label>
          <Form.Control
            {...form.register('fullName')}
            isInvalid={Boolean(form.formState.errors.fullName)}
          />
          <Form.Control.Feedback type="invalid">
            {form.formState.errors.fullName?.message}
          </Form.Control.Feedback>
        </Form.Group>

        <Form.Group controlId="displayName">
          <Form.Label>Nombre para mostrar</Form.Label>
          <Form.Control
            {...form.register('displayName')}
            isInvalid={Boolean(form.formState.errors.displayName)}
          />
          <Form.Control.Feedback type="invalid">
            {form.formState.errors.displayName?.message}
          </Form.Control.Feedback>
        </Form.Group>

        <Form.Group controlId="bio" className="ca-form-grid__full">
          <Form.Label>Biografía</Form.Label>
          <Form.Control
            as="textarea"
            rows={4}
            {...form.register('bio')}
            isInvalid={Boolean(form.formState.errors.bio)}
          />
          <Form.Control.Feedback type="invalid">
            {form.formState.errors.bio?.message}
          </Form.Control.Feedback>
        </Form.Group>

        <div className="ca-form-actions ca-form-grid__full">
          <Button type="submit" className="ca-btn-primary" disabled={update.isPending}>
            {update.isPending ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        </div>
      </Form>
    </section>
  );
}
