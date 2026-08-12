import { Button, Form } from 'react-bootstrap';
import { Controller } from 'react-hook-form';
import { Settings2 } from 'lucide-react';
import { useEffect } from 'react';

import { useZodForm } from '@/shared/lib/form';
import { isAppCurrency, type AppCurrency } from '@/shared/lib/money';
import { useUserPreferences } from '@/shared/preferences';
import { useAppToast } from '@/shared/ui';

import { useUpdateProfile } from '../../hooks/useProfile';
import { settingsFormSchema, type SettingsFormValues } from '../../model/schemas';
import type { UserProfile } from '../../model/types';
import { CurrencySelect } from './CurrencySelect';
import { EditProfileSection } from './EditProfileSection';
import { KycDocumentsSection } from './KycDocumentsSection';
import { PaymentMethodSection } from './PaymentMethodSection';
import { LanguageSelect, normalizeAppLanguage } from './LanguageSelect';
import { ThemeSelect } from './ThemeSelect';
import { TimezoneSelect } from './TimezoneSelect';

function normalizeCurrency(value: string | undefined): AppCurrency {
  const code = (value ?? 'UYU').toUpperCase();
  return isAppCurrency(code) ? code : 'UYU';
}

function preferencesToFormValues(profile: UserProfile): SettingsFormValues {
  return {
    ...profile.preferences,
    language: normalizeAppLanguage(profile.preferences.language),
    currency: normalizeCurrency(profile.preferences.currency),
  };
}

export function SettingsSection({
  profile,
  onPhoneVerifiedUiChange,
}: {
  profile: UserProfile;
  onPhoneVerifiedUiChange?: (verified: boolean) => void;
}) {
  const update = useUpdateProfile();
  const { applyLocalPrefs } = useUserPreferences();
  const toast = useAppToast();

  const form = useZodForm(settingsFormSchema, {
    defaultValues: preferencesToFormValues(profile),
  });

  useEffect(() => {
    form.reset(preferencesToFormValues(profile));
  }, [profile, form]);

  useEffect(() => {
    if (!profile.phoneVerified && form.getValues('notifications.sms')) {
      form.setValue('notifications.sms', false, { shouldDirty: false });
    }
  }, [profile.phoneVerified, form]);

  const onSubmit = form.handleSubmit(async (values: SettingsFormValues) => {
    const preferences = {
      ...values,
      notifications: {
        ...values.notifications,
        sms: profile.phoneVerified ? values.notifications.sms : false,
      },
    };
    applyLocalPrefs({
      language: preferences.language,
      timezone: preferences.timezone,
      currency: preferences.currency,
      theme: preferences.theme,
      distanceUnit: preferences.distanceUnit,
    });
    await update.mutateAsync({ preferences });
    toast.success('Configuración guardada.');
  });

  const notifications = form.watch('notifications');
  const privacy = form.watch('privacy');

  return (
    <div className="ca-profile__stack">
      <section>
        <h3 className="ca-section-title">
          <Settings2 size={22} strokeWidth={1.75} aria-hidden />
          Configuración
        </h3>

        <Form onSubmit={onSubmit} className="ca-settings-form">
          <div className="row g-3">
            {/* lg: 2+4+2+2+2 · md: 6+6 / 4+4+4 · xs: stack + pares */}
            <Form.Group className="col-12 col-md-6 col-lg-2" controlId="language">
              <Form.Label>Idioma</Form.Label>
              <Controller
                name="language"
                control={form.control}
                render={({ field }) => (
                  <LanguageSelect
                    id="language"
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                  />
                )}
              />
            </Form.Group>
            <Form.Group className="col-12 col-md-6 col-lg-4" controlId="timezone">
              <Form.Label>Zona horaria</Form.Label>
              <Controller
                name="timezone"
                control={form.control}
                render={({ field }) => (
                  <TimezoneSelect
                    id="timezone"
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                  />
                )}
              />
            </Form.Group>
            <Form.Group className="col-6 col-md-4 col-lg-2" controlId="currency">
              <Form.Label>Moneda</Form.Label>
              <Controller
                name="currency"
                control={form.control}
                render={({ field }) => (
                  <CurrencySelect
                    id="currency"
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                  />
                )}
              />
            </Form.Group>
            <Form.Group className="col-6 col-md-4 col-lg-2" controlId="theme">
              <Form.Label>Tema</Form.Label>
              <Controller
                name="theme"
                control={form.control}
                render={({ field }) => (
                  <ThemeSelect
                    id="theme"
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                  />
                )}
              />
            </Form.Group>
            <Form.Group className="col-12 col-md-4 col-lg-2" controlId="distanceUnit">
              <Form.Label>Unidad de distancia</Form.Label>
              <Form.Select {...form.register('distanceUnit')}>
                <option value="KM">Kilómetros</option>
                <option value="MI">Millas</option>
              </Form.Select>
            </Form.Group>

            <div className="col-12">
              <div className="row g-3 ca-settings-panels">
                <div className="col-12 col-lg-8">
                  <fieldset className="ca-fieldset ca-fieldset--notifications">
                    <legend>Notificaciones</legend>
                    <div className="row g-3">
                      <div className="col-12 col-sm-6">
                        <h4 className="ca-fieldset__subtitle">Canales</h4>
                        {(
                          [
                            ['email', 'Email'],
                            ['push', 'Push'],
                            ['sms', 'SMS'],
                            ['inApp', 'In-app'],
                          ] as const
                        ).map(([key, label]) => {
                          const smsLocked = key === 'sms' && !profile.phoneVerified;
                          return (
                            <Form.Check
                              key={key}
                              type="switch"
                              id={`notif-${key}`}
                              label={label}
                              checked={smsLocked ? false : (notifications?.[key] ?? false)}
                              disabled={smsLocked}
                              title={
                                smsLocked
                                  ? 'Verificá tu teléfono para activar notificaciones SMS'
                                  : undefined
                              }
                              onChange={(event) =>
                                form.setValue(`notifications.${key}`, event.target.checked, {
                                  shouldDirty: true,
                                })
                              }
                            />
                          );
                        })}
                      </div>
                      <div className="col-12 col-sm-6">
                        <h4 className="ca-fieldset__subtitle">Temas</h4>
                        {(
                          [
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
                      </div>
                    </div>
                  </fieldset>
                </div>

                <div className="col-12 col-lg-4">
                  <fieldset className="ca-fieldset">
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
                </div>
              </div>
            </div>

            <div className="col-12 ca-form-actions">
              <Button type="submit" className="ca-btn-cta" disabled={update.isPending}>
                Guardar configuración
              </Button>
            </div>
          </div>
        </Form>
      </section>

      <EditProfileSection profile={profile} onPhoneVerifiedUiChange={onPhoneVerifiedUiChange} />
      <KycDocumentsSection profile={profile} />
      <PaymentMethodSection profile={profile} />
    </div>
  );
}
