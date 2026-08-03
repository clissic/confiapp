import { Alert, Button, Form } from 'react-bootstrap';
import { useEffect, useState } from 'react';

import { useZodForm } from '@/shared/lib/form';

import { useUpdateProfile } from '../../hooks/useProfile';
import { settingsFormSchema, type SettingsFormValues } from '../../model/schemas';
import type { UserProfile } from '../../model/types';

export function SettingsSection({ profile }: { profile: UserProfile }) {
  const update = useUpdateProfile();
  const [feedback, setFeedback] = useState<string | null>(null);

  const form = useZodForm(settingsFormSchema, {
    defaultValues: profile.preferences,
  });

  useEffect(() => {
    form.reset(profile.preferences);
  }, [profile, form]);

  const onSubmit = form.handleSubmit(async (values: SettingsFormValues) => {
    setFeedback(null);
    await update.mutateAsync({ preferences: values });
    setFeedback('Configuración guardada.');
  });

  const notifications = form.watch('notifications');
  const privacy = form.watch('privacy');

  return (
    <section>
      <h3 className="ca-section-title">Configuración</h3>
      <p className="ca-section-lead">Preferencias de idioma, privacidad y notificaciones.</p>

      {feedback ? <Alert variant="success">{feedback}</Alert> : null}

      <Form onSubmit={onSubmit} className="ca-form-grid">
        <Form.Group controlId="language">
          <Form.Label>Idioma</Form.Label>
          <Form.Control {...form.register('language')} />
        </Form.Group>
        <Form.Group controlId="locale">
          <Form.Label>Locale</Form.Label>
          <Form.Control {...form.register('locale')} />
        </Form.Group>
        <Form.Group controlId="timezone">
          <Form.Label>Zona horaria</Form.Label>
          <Form.Control {...form.register('timezone')} />
        </Form.Group>
        <Form.Group controlId="currency">
          <Form.Label>Moneda</Form.Label>
          <Form.Control
            {...form.register('currency')}
            isInvalid={Boolean(form.formState.errors.currency)}
          />
          <Form.Control.Feedback type="invalid">
            {form.formState.errors.currency?.message}
          </Form.Control.Feedback>
        </Form.Group>
        <Form.Group controlId="theme">
          <Form.Label>Tema</Form.Label>
          <Form.Select {...form.register('theme')}>
            <option value="SYSTEM">Sistema</option>
            <option value="LIGHT">Claro</option>
            <option value="DARK">Oscuro</option>
          </Form.Select>
        </Form.Group>
        <Form.Group controlId="distanceUnit">
          <Form.Label>Unidad de distancia</Form.Label>
          <Form.Select {...form.register('distanceUnit')}>
            <option value="KM">Kilómetros</option>
            <option value="MI">Millas</option>
          </Form.Select>
        </Form.Group>

        <fieldset className="ca-fieldset ca-form-grid__full">
          <legend>Notificaciones</legend>
          {(
            [
              ['email', 'Email'],
              ['push', 'Push'],
              ['sms', 'SMS'],
              ['inApp', 'In-app'],
              ['marketing', 'Marketing'],
              ['transactionUpdates', 'Actualizaciones de operación'],
              ['messageAlerts', 'Mensajes'],
              ['paymentAlerts', 'Pagos'],
              ['disputeAlerts', 'Disputas'],
            ] as const
          ).map(([key, label]) => (
            <Form.Check
              key={key}
              type="switch"
              id={`notif-${key}`}
              label={label}
              checked={notifications?.[key] ?? false}
              onChange={(event) =>
                form.setValue(`notifications.${key}`, event.target.checked, {
                  shouldDirty: true,
                })
              }
            />
          ))}
        </fieldset>

        <fieldset className="ca-fieldset ca-form-grid__full">
          <legend>Privacidad</legend>
          {(
            [
              ['showLocation', 'Mostrar ubicación'],
              ['showPhone', 'Mostrar teléfono'],
              ['showEmail', 'Mostrar email'],
              ['showRating', 'Mostrar calificaciones'],
            ] as const
          ).map(([key, label]) => (
            <Form.Check
              key={key}
              type="switch"
              id={`privacy-${key}`}
              label={label}
              checked={privacy?.[key] ?? false}
              onChange={(event) =>
                form.setValue(`privacy.${key}`, event.target.checked, {
                  shouldDirty: true,
                })
              }
            />
          ))}
          <Form.Group controlId="profileVisibility" className="mt-2">
            <Form.Label>Visibilidad del perfil</Form.Label>
            <Form.Select {...form.register('privacy.profileVisibility')}>
              <option value="PUBLIC">Público</option>
              <option value="CONTACTS">Contactos</option>
              <option value="PRIVATE">Privado</option>
            </Form.Select>
          </Form.Group>
        </fieldset>

        <div className="ca-form-actions ca-form-grid__full">
          <Button type="submit" className="ca-btn-cta" disabled={update.isPending}>
            Guardar configuración
          </Button>
        </div>
      </Form>
    </section>
  );
}
