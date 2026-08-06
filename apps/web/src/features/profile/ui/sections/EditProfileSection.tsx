import { Alert, Button, Form } from 'react-bootstrap';
import { Controller } from 'react-hook-form';
import { UserRoundPen } from 'lucide-react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { useZodForm } from '@/shared/lib/form';
import { useAppToast } from '@/shared/ui';

import { useUpdateProfile } from '../../hooks/useProfile';
import {
  composePhoneNumber,
  DEFAULT_COUNTRY_ISO,
  splitPhoneNumber,
} from '../../model/country-dial-codes';
import {
  clearLocalVerifiedPhone,
  isPhoneCurrentlyVerified,
  phonesMatch,
} from '../../model/phone-verification';
import { editProfileSchema, type EditProfileValues } from '../../model/schemas';
import type { UserProfile } from '../../model/types';
import { CountryDialSelect, CountrySelect } from './CountryDialSelect';
import { UruguayCitySelect } from './UruguayCitySelect';

function splitStreetLine(line1: string | undefined): { street: string; streetNumber: string } {
  const value = (line1 ?? '').trim();
  if (!value) return { street: '', streetNumber: '' };
  const match = value.match(/^(.*?)(?:\s+)(\d+[A-Za-z0-9\-º°]*)$/);
  if (!match) return { street: value, streetNumber: '' };
  return {
    street: (match[1] ?? '').trim(),
    streetNumber: match[2] ?? '',
  };
}

function profileToFormValues(profile: UserProfile): EditProfileValues {
  const streetParts = splitStreetLine(profile.address.line1);
  const phoneParts = splitPhoneNumber(profile.phone);
  return {
    fullName: profile.fullName,
    documentNumber: profile.documentNumber ?? '',
    bio: profile.bio ?? '',
    street: streetParts.street,
    streetNumber: streetParts.streetNumber,
    floor: profile.address.line2 ?? '',
    country: profile.address.country ?? 'UY',
    state: profile.address.state ?? '',
    city: profile.address.city ?? '',
    neighborhood: profile.locationLabel ?? '',
    postalCode: profile.address.postalCode ?? '',
    countryIso: phoneParts.countryIso || DEFAULT_COUNTRY_ISO,
    nationalNumber: phoneParts.nationalNumber,
  };
}

/** Formulario unificado: datos personales, dirección y teléfono. */
export function EditProfileSection({
  profile,
  onPhoneVerifiedUiChange,
}: {
  profile: UserProfile;
  onPhoneVerifiedUiChange?: (verified: boolean) => void;
}) {
  const update = useUpdateProfile();
  const toast = useAppToast();
  const navigate = useNavigate();

  const form = useZodForm(editProfileSchema, {
    defaultValues: profileToFormValues(profile),
  });

  useEffect(() => {
    form.reset(profileToFormValues(profile));
  }, [profile, form]);

  const countryIso = form.watch('countryIso');
  const nationalNumber = form.watch('nationalNumber');
  const currentPhone =
    nationalNumber && nationalNumber.length > 0
      ? composePhoneNumber(countryIso, nationalNumber)
      : '';

  const phoneVerifiedUi = isPhoneCurrentlyVerified({
    currentPhone,
    savedPhone: profile.phone,
    profilePhoneVerified: profile.phoneVerified,
  });

  useEffect(() => {
    onPhoneVerifiedUiChange?.(phoneVerifiedUi);
  }, [phoneVerifiedUi, onPhoneVerifiedUiChange]);

  const onSubmit = form.handleSubmit(async (values: EditProfileValues) => {
    const line1 = [values.street?.trim(), values.streetNumber?.trim()].filter(Boolean).join(' ');
    const phone =
      values.nationalNumber && values.nationalNumber.length > 0
        ? composePhoneNumber(values.countryIso, values.nationalNumber)
        : null;

    if (!phonesMatch(phone, profile.phone)) {
      clearLocalVerifiedPhone();
    }

    await update.mutateAsync({
      fullName: values.fullName,
      documentNumber: values.documentNumber || null,
      bio: values.bio || null,
      phone,
      locationLabel: values.neighborhood || null,
      address: {
        line1: line1 || undefined,
        line2: values.floor || undefined,
        city: values.city || undefined,
        state: values.state || undefined,
        country: values.country || undefined,
        postalCode: values.postalCode || undefined,
      },
    });
    toast.success('Perfil actualizado correctamente.');
  });

  const nationalNumberField = form.register('nationalNumber');
  const postalCodeField = form.register('postalCode');

  return (
    <section id="editar-perfil">
      <h3 className="ca-section-title">
        <UserRoundPen size={22} strokeWidth={1.75} aria-hidden />
        Editar perfil
      </h3>

      {update.isError ? <Alert variant="danger">No se pudo guardar.</Alert> : null}

      <Form onSubmit={onSubmit} className="ca-profile-edit">
        <div className="row g-3">
          {/* ~30% + 30% + 15% + 25% → col-lg-3 + 3 + 2 + 4 */}
          <Form.Group className="col-12 col-md-6 col-lg-3" controlId="fullName">
            <Form.Label>Nombre completo</Form.Label>
            <Form.Control
              {...form.register('fullName')}
              isInvalid={Boolean(form.formState.errors.fullName)}
            />
            <Form.Control.Feedback type="invalid">
              {form.formState.errors.fullName?.message}
            </Form.Control.Feedback>
          </Form.Group>

          <Form.Group className="col-12 col-md-6 col-lg-3" controlId="documentNumber">
            <Form.Label>DNI / Pasaporte</Form.Label>
            <Form.Control
              {...form.register('documentNumber')}
              autoComplete="off"
              placeholder="12345678"
              isInvalid={Boolean(form.formState.errors.documentNumber)}
            />
            <Form.Control.Feedback type="invalid">
              {form.formState.errors.documentNumber?.message}
            </Form.Control.Feedback>
          </Form.Group>

          <Form.Group className="col-5 col-md-4 col-lg-2" controlId="phone-country">
            <Form.Label>Teléfono</Form.Label>
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
          </Form.Group>

          <Form.Group className="col-7 col-md-8 col-lg-4" controlId="nationalNumber">
            <Form.Label>Número</Form.Label>
            <div className="ca-phone-verify-field">
              <Form.Control
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
              <button
                type="button"
                className="ca-phone-verify-field__btn"
                aria-label={
                  phoneVerifiedUi
                    ? 'Teléfono verificado'
                    : 'Solicitar verificación de teléfono'
                }
                title={phoneVerifiedUi ? 'Teléfono verificado' : 'Solicitar verificación'}
                disabled={phoneVerifiedUi}
                onClick={() => {
                  if (phoneVerifiedUi) return;
                  const values = form.getValues();
                  const phone =
                    values.nationalNumber && values.nationalNumber.length > 0
                      ? composePhoneNumber(values.countryIso, values.nationalNumber)
                      : profile.phone || undefined;
                  navigate('/perfil/verificar-telefono', { state: { phone } });
                }}
              >
                <i className="bi bi-question-circle" aria-hidden />
              </button>
            </div>
            <Form.Control.Feedback type="invalid" className="d-block">
              {form.formState.errors.countryIso?.message ||
                form.formState.errors.nationalNumber?.message}
            </Form.Control.Feedback>
          </Form.Group>

          <Form.Group className="col-12" controlId="bio">
            <Form.Label>Biografía</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              {...form.register('bio')}
              isInvalid={Boolean(form.formState.errors.bio)}
            />
            <Form.Control.Feedback type="invalid">
              {form.formState.errors.bio?.message}
            </Form.Control.Feedback>
          </Form.Group>

          <Form.Group className="col-9 col-md-10" controlId="street">
            <Form.Label>Calle</Form.Label>
            <Form.Control {...form.register('street')} placeholder="Av. 18 de Julio" />
          </Form.Group>

          <Form.Group className="col-3 col-md-2" controlId="streetNumber">
            <Form.Label>Número</Form.Label>
            <Form.Control {...form.register('streetNumber')} placeholder="1234" />
          </Form.Group>

          {/* ~35% + 30% + 35% → col-4 + col-4 + col-4 */}
          <Form.Group className="col-4" controlId="floor">
            <Form.Label>Piso/depto</Form.Label>
            <Form.Control {...form.register('floor')} placeholder="Opcional" />
          </Form.Group>

          <Form.Group className="col-4" controlId="postalCode">
            <Form.Label>Código postal</Form.Label>
            <Form.Control
              type="tel"
              inputMode="numeric"
              name={postalCodeField.name}
              ref={postalCodeField.ref}
              onBlur={postalCodeField.onBlur}
              onChange={(event) => {
                event.target.value = event.target.value.replace(/\D/g, '');
                void postalCodeField.onChange(event);
              }}
              isInvalid={Boolean(form.formState.errors.postalCode)}
            />
            <Form.Control.Feedback type="invalid">
              {form.formState.errors.postalCode?.message}
            </Form.Control.Feedback>
          </Form.Group>

          <Form.Group className="col-4" controlId="neighborhood">
            <Form.Label>Barrio</Form.Label>
            <Form.Control {...form.register('neighborhood')} placeholder="Centro" />
          </Form.Group>

          <Form.Group className="col-4" controlId="city">
            <Form.Label>Ciudad</Form.Label>
            <Controller
              name="city"
              control={form.control}
              render={({ field }) => (
                <UruguayCitySelect
                  id="city"
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  invalid={Boolean(form.formState.errors.city)}
                />
              )}
            />
            {form.formState.errors.city ? (
              <div className="invalid-feedback d-block">{form.formState.errors.city.message}</div>
            ) : null}
          </Form.Group>

          <Form.Group className="col-4" controlId="state">
            <Form.Label>Provincia/Estado</Form.Label>
            <Form.Control {...form.register('state')} placeholder="Montevideo" />
          </Form.Group>

          <Form.Group className="col-4" controlId="country">
            <Form.Label>País</Form.Label>
            <Controller
              name="country"
              control={form.control}
              render={({ field }) => (
                <CountrySelect
                  id="address-country"
                  variant="name"
                  value={field.value || 'UY'}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  invalid={Boolean(form.formState.errors.country)}
                />
              )}
            />
            <Form.Control.Feedback type="invalid" className="d-block">
              {form.formState.errors.country?.message}
            </Form.Control.Feedback>
          </Form.Group>

          <div className="col-12 ca-form-actions">
            <Button type="submit" className="ca-btn-cta" disabled={update.isPending}>
              {update.isPending ? 'Guardando…' : 'Guardar perfil'}
            </Button>
          </div>
        </div>
      </Form>
    </section>
  );
}
