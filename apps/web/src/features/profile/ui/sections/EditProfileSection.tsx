import { Alert, Button, Form, Modal, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { Controller } from 'react-hook-form';
import { Lock, UserRoundPen } from 'lucide-react';
import { useEffect, useState, type ChangeEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

import { useZodForm } from '@/shared/lib/form';
import { useAppToast } from '@/shared/ui';

import { useAuth } from '@/features/auth/ui/AuthProvider';

import { requestIdentityChange } from '../../api/profile.api';
import { useUpdateProfile } from '../../hooks/useProfile';
import {
  composePhoneNumber,
  DEFAULT_COUNTRY_ISO,
  splitPhoneNumber,
} from '../../model/country-dial-codes';
import {
  ADDRESS_PROOF_ACCEPTED_TYPES,
  fileToAddressProofDataUrl,
} from '../../model/image-source';
import {
  clearLocalVerifiedPhone,
  isPhoneCurrentlyVerified,
  phonesMatch,
} from '../../model/phone-verification';
import { editProfileSchema, type EditProfileValues } from '../../model/schemas';
import type { UserProfile } from '../../model/types';
import { CountryDialSelect, CountrySelect } from './CountryDialSelect';
import { UruguayCitySelect } from './UruguayCitySelect';

const IDENTITY_LOCK_HINT =
  'Tu identidad está verificada. Nombre, documento y dirección no se pueden modificar desde acá; para cambiarlos contactá a la administración de ConfiApp.';

function LockedFieldLabel({
  children,
  locked,
  tipId,
}: {
  children: ReactNode;
  locked: boolean;
  tipId: string;
}) {
  return (
    <Form.Label className={locked ? 'ca-profile-edit__locked-label' : undefined}>
      <span>{children}</span>
      {locked ? (
        <OverlayTrigger
          placement="top"
          overlay={<Tooltip id={tipId}>{IDENTITY_LOCK_HINT}</Tooltip>}
        >
          <span
            className="ca-profile-edit__lock"
            tabIndex={0}
            role="img"
            aria-label={IDENTITY_LOCK_HINT}
          >
            <Lock size={14} strokeWidth={2.25} aria-hidden />
          </span>
        </OverlayTrigger>
      ) : null}
    </Form.Label>
  );
}

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
  const { user } = useAuth();
  const [showChangeRequest, setShowChangeRequest] = useState(false);
  const [changeMessage, setChangeMessage] = useState('');
  const [changeFileName, setChangeFileName] = useState<string | null>(null);
  const [changeAttachment, setChangeAttachment] = useState<string | null>(null);
  const [changeError, setChangeError] = useState<string | null>(null);
  const [changeSending, setChangeSending] = useState(false);

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
    userId: user?.id ?? profile.id,
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
  const identityLocked =
    profile.kyc?.status === 'VERIFIED' || Boolean(profile.identityVerified);

  const openChangeRequest = () => {
    setChangeMessage('');
    setChangeFileName(null);
    setChangeAttachment(null);
    setChangeError(null);
    setShowChangeRequest(true);
  };

  const onPickChangeFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) {
      setChangeFileName(null);
      setChangeAttachment(null);
      return;
    }
    setChangeError(null);
    try {
      const dataUrl = await fileToAddressProofDataUrl(file);
      setChangeAttachment(dataUrl);
      setChangeFileName(file.name);
    } catch (error) {
      setChangeAttachment(null);
      setChangeFileName(null);
      setChangeError(error instanceof Error ? error.message : 'No se pudo leer el archivo.');
      input.value = '';
    }
  };

  const submitChangeRequest = async () => {
    const trimmed = changeMessage.trim();
    if (trimmed.length < 10) {
      setChangeError('Contanos qué datos querés modificar (mínimo 10 caracteres).');
      return;
    }
    setChangeError(null);
    setChangeSending(true);
    try {
      await requestIdentityChange(trimmed, changeAttachment ?? undefined);
      setShowChangeRequest(false);
      toast.success('Solicitud enviada. La administración de ConfiApp te contactará.');
    } catch {
      setChangeError('No se pudo enviar la solicitud. Probá de nuevo.');
    } finally {
      setChangeSending(false);
    }
  };

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
            <LockedFieldLabel locked={identityLocked} tipId="lock-fullName">
              Nombre completo
            </LockedFieldLabel>
            <Form.Control
              {...form.register('fullName')}
              disabled={identityLocked}
              isInvalid={Boolean(form.formState.errors.fullName)}
            />
            <Form.Control.Feedback type="invalid">
              {form.formState.errors.fullName?.message}
            </Form.Control.Feedback>
          </Form.Group>

          <Form.Group className="col-12 col-md-6 col-lg-3" controlId="documentNumber">
            <LockedFieldLabel locked={identityLocked} tipId="lock-documentNumber">
              DNI / Pasaporte
            </LockedFieldLabel>
            <Form.Control
              {...form.register('documentNumber')}
              disabled={identityLocked}
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
            <LockedFieldLabel locked={identityLocked} tipId="lock-street">
              Calle
            </LockedFieldLabel>
            <Form.Control
              {...form.register('street')}
              disabled={identityLocked}
              placeholder="Av. 18 de Julio"
            />
          </Form.Group>

          <Form.Group className="col-3 col-md-2" controlId="streetNumber">
            <LockedFieldLabel locked={identityLocked} tipId="lock-streetNumber">
              Número
            </LockedFieldLabel>
            <Form.Control
              {...form.register('streetNumber')}
              disabled={identityLocked}
              placeholder="1234"
            />
          </Form.Group>

          {/* ~35% + 30% + 35% → col-4 + col-4 + col-4 */}
          <Form.Group className="col-4" controlId="floor">
            <LockedFieldLabel locked={identityLocked} tipId="lock-floor">
              Piso/depto
            </LockedFieldLabel>
            <Form.Control
              {...form.register('floor')}
              disabled={identityLocked}
              placeholder="Opcional"
            />
          </Form.Group>

          <Form.Group className="col-4" controlId="postalCode">
            <LockedFieldLabel locked={identityLocked} tipId="lock-postalCode">
              Código postal
            </LockedFieldLabel>
            <Form.Control
              type="tel"
              inputMode="numeric"
              disabled={identityLocked}
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
            <LockedFieldLabel locked={identityLocked} tipId="lock-neighborhood">
              Barrio
            </LockedFieldLabel>
            <Form.Control
              {...form.register('neighborhood')}
              disabled={identityLocked}
              placeholder="Centro"
            />
          </Form.Group>

          <Form.Group className="col-4" controlId="city">
            <LockedFieldLabel locked={identityLocked} tipId="lock-city">
              Ciudad
            </LockedFieldLabel>
            <Controller
              name="city"
              control={form.control}
              render={({ field }) => (
                <UruguayCitySelect
                  id="city"
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  disabled={identityLocked}
                  invalid={Boolean(form.formState.errors.city)}
                />
              )}
            />
            {form.formState.errors.city ? (
              <div className="invalid-feedback d-block">{form.formState.errors.city.message}</div>
            ) : null}
          </Form.Group>

          <Form.Group className="col-4" controlId="state">
            <LockedFieldLabel locked={identityLocked} tipId="lock-state">
              Provincia/Estado
            </LockedFieldLabel>
            <Form.Control
              {...form.register('state')}
              disabled={identityLocked}
              placeholder="Montevideo"
            />
          </Form.Group>

          <Form.Group className="col-4" controlId="country">
            <LockedFieldLabel locked={identityLocked} tipId="lock-country">
              País
            </LockedFieldLabel>
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
                  disabled={identityLocked}
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
            {identityLocked ? (
              <Button
                type="button"
                variant="outline-secondary"
                disabled={update.isPending || changeSending}
                onClick={openChangeRequest}
              >
                Solicitar modificación
              </Button>
            ) : null}
          </div>
        </div>
      </Form>

      <Modal
        show={showChangeRequest}
        onHide={() => {
          if (changeSending) return;
          setShowChangeRequest(false);
        }}
        centered
        aria-labelledby="identity-change-title"
      >
        <Modal.Header closeButton={!changeSending}>
          <Modal.Title id="identity-change-title">Solicitar modificación</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="mb-3 text-muted">
            Como tu identidad está verificada, nombre, documento y dirección solo los puede
            cambiar la administración. Contanos qué querés modificar y por qué.
          </p>
          {changeError ? <Alert variant="danger">{changeError}</Alert> : null}
          <Form.Group controlId="identity-change-message" className="mb-3">
            <Form.Label>Detalle de la solicitud</Form.Label>
            <Form.Control
              as="textarea"
              rows={4}
              value={changeMessage}
              disabled={changeSending}
              onChange={(event) => setChangeMessage(event.target.value)}
              placeholder="Ej. Cambié de domicilio a… / Necesito corregir mi número de documento…"
            />
          </Form.Group>
          <Form.Group controlId="identity-change-file">
            <Form.Label>Archivo de respaldo (opcional)</Form.Label>
            <Form.Control
              type="file"
              accept={ADDRESS_PROOF_ACCEPTED_TYPES.join(',')}
              disabled={changeSending}
              onChange={(event) => {
                const input = event.currentTarget;
                if (!(input instanceof HTMLInputElement)) return;
                void onPickChangeFile({
                  ...event,
                  target: input,
                  currentTarget: input,
                } as ChangeEvent<HTMLInputElement>);
              }}
            />
            <Form.Text muted>
              {changeFileName
                ? `Seleccionado: ${changeFileName}`
                : 'JPG, PNG, WEBP, GIF o PDF · máx. 4 MB'}
            </Form.Text>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="outline-secondary"
            disabled={changeSending}
            onClick={() => setShowChangeRequest(false)}
          >
            Cancelar
          </Button>
          <Button
            className="ca-btn-cta"
            disabled={changeSending || changeMessage.trim().length < 10}
            onClick={() => void submitChangeRequest()}
          >
            {changeSending ? 'Enviando…' : 'Enviar solicitud'}
          </Button>
        </Modal.Footer>
      </Modal>
    </section>
  );
}
