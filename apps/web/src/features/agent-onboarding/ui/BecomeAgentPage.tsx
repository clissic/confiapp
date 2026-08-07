import { useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Form, Spinner } from 'react-bootstrap';
import { Controller } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, ShieldCheck, Trash2 } from 'lucide-react';

import { useZodForm } from '@/shared/lib/form';
import { distanceUnitLabel, formatDistance, fromKm, toKm } from '@/shared/lib/distance';
import { useUserPreferences } from '@/shared/preferences';
import { useAppToast } from '@/shared/ui';
import { useProfile } from '@/features/profile/hooks/useProfile';
import { TimezoneSelect } from '@/features/profile/ui/sections/TimezoneSelect';
import { CountrySelect } from '@/features/profile/ui/sections/CountryDialSelect';
import { UruguayCitySelect } from '@/features/profile/ui/sections/UruguayCitySelect';

import {
  useAgentOnboarding,
  useCloseAgency,
  useResumeAgent,
  useSaveAgentDraft,
  useSubmitAgentOnboarding,
  useSuspendAgent,
} from '../hooks/useAgentOnboarding';
import {
  areaStepSchema,
  DAY_LABELS,
  DAYS,
  rateStepSchema,
  scheduleStepSchema,
  termsStepSchema,
  type AreaStepValues,
  type ScheduleStepValues,
} from '../model/schemas';
import type { AgentOnboarding, AgentScheduleSlot } from '../model/types';
import { AgentAgencyPanel } from './AgentAgencyPanel';
import '../styles/agent-onboarding.css';

const STEPS = [
  { id: 1, label: 'Términos' },
  { id: 2, label: 'Horarios' },
  { id: 3, label: 'Área' },
  { id: 4, label: 'Tarifa' },
  { id: 5, label: 'Vista previa' },
] as const;

export function BecomeAgentPage() {
  const toast = useAppToast();
  const { data, isLoading, isError } = useAgentOnboarding();
  const saveDraft = useSaveAgentDraft();
  const submit = useSubmitAgentOnboarding();
  const suspend = useSuspendAgent();
  const resume = useResumeAgent();
  const closeAgency = useCloseAgency();
  const [step, setStep] = useState(1);
  const [editSection, setEditSection] = useState<'schedule' | 'area' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onboarding = data?.data;
  const isRegistered =
    onboarding?.status === 'ACTIVE' || onboarding?.status === 'INACTIVE';

  useEffect(() => {
    if (!onboarding) return;
    if (isRegistered) {
      setStep(5);
      return;
    }
    if (onboarding.draftStep) {
      setStep(onboarding.draftStep);
    }
  }, [onboarding?.draftStep, onboarding?.status, isRegistered]);

  if (isLoading) {
    return (
      <div className="ca-agent-flow ca-agent-flow--loading">
        <Spinner animation="border" />
        <span>Cargando onboarding…</span>
      </div>
    );
  }

  if (isError || !onboarding) {
    return <Alert variant="danger">No se pudo cargar el flujo de agente.</Alert>;
  }

  const busy =
    saveDraft.isPending ||
    submit.isPending ||
    suspend.isPending ||
    resume.isPending ||
    closeAgency.isPending;

  return (
    <div className="ca-agent-flow">
      <header className="ca-agent-flow__header">
        <div className="ca-agent-flow__brand">
          <ShieldCheck size={22} strokeWidth={1.75} />
          <div>
            <p className="ca-agent-flow__kicker">
              {isRegistered ? 'Tu agencia' : 'Convertirse en agente'}
            </p>
            <h2 className="ca-agent-flow__title">
              {isRegistered ? 'Gestión de intermediario' : 'Onboarding de intermediario'}
            </h2>
          </div>
        </div>
        <div
          className={[
            'ca-agent-flow__meta',
            onboarding.status === 'ACTIVE' ? 'ca-agent-flow__meta--hide-mobile' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <Badge bg={onboarding.status === 'INACTIVE' ? 'secondary' : 'primary'}>
            {onboarding.status}
          </Badge>
        </div>
      </header>

      {!isRegistered ? (
        <div className="ca-agent-steps-wrap">
          <ol className="ca-agent-steps" aria-label="Pasos del onboarding">
            {STEPS.map((item) => (
              <li
                key={item.id}
                className={[
                  'ca-agent-steps__item',
                  step === item.id ? 'ca-agent-steps__item--active' : '',
                  step > item.id ? 'ca-agent-steps__item--done' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                aria-current={step === item.id ? 'step' : undefined}
              >
                <span className="ca-agent-steps__num">{item.id}</span>
                <span className="ca-agent-steps__label">{item.label}</span>
              </li>
            ))}
          </ol>
          <p className="ca-agent-steps__current" aria-live="polite">
            {STEPS.find((item) => item.id === step)?.label}
          </p>
        </div>
      ) : null}

      {error ? <Alert variant="danger">{error}</Alert> : null}

      <motion.div
        key={isRegistered ? `agency-${editSection ?? 'summary'}` : step}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="ca-agent-panel"
      >
        {isRegistered && editSection === 'schedule' ? (
          <ScheduleStep
            onboarding={onboarding}
            disabled={false}
            saving={saveDraft.isPending}
            onBack={() => setEditSection(null)}
            onNext={async (values) => {
              setError(null);
              try {
                await saveDraft.mutateAsync({ ...values });
                toast.success('Horarios actualizados.');
                setEditSection(null);
              } catch {
                setError('No se pudieron actualizar los horarios.');
              }
            }}
          />
        ) : null}

        {isRegistered && editSection === 'area' ? (
          <AreaStep
            onboarding={onboarding}
            disabled={false}
            saving={saveDraft.isPending}
            onBack={() => setEditSection(null)}
            onNext={async (values) => {
              setError(null);
              try {
                await saveDraft.mutateAsync({ ...values });
                toast.success('Área actualizada.');
                setEditSection(null);
              } catch {
                setError('No se pudo actualizar el área.');
              }
            }}
          />
        ) : null}

        {isRegistered && !editSection ? (
          <AgentAgencyPanel
            onboarding={onboarding}
            busy={busy}
            onEditSchedule={() => setEditSection('schedule')}
            onEditArea={() => setEditSection('area')}
            onSuspend={async () => {
              setError(null);
              try {
                await suspend.mutateAsync();
                toast.success('Actividad suspendida. Estado: INACTIVE.');
              } catch {
                setError('No se pudo suspender la actividad.');
              }
            }}
            onResume={async () => {
              setError(null);
              try {
                await resume.mutateAsync();
                toast.success('Actividad reactivada.');
              } catch {
                setError('No se pudo reactivar la actividad.');
              }
            }}
            onClose={async () => {
              const ok = window.confirm(
                '¿Cerrar la agencia? Vas a tener que completar el onboarding de nuevo. Tus estadísticas se conservan.',
              );
              if (!ok) return;
              setError(null);
              try {
                await closeAgency.mutateAsync();
                setEditSection(null);
                setStep(1);
                toast.success('Agencia cerrada. Podés volver a registrarte cuando quieras.');
              } catch {
                setError('No se pudo cerrar la agencia.');
              }
            }}
          />
        ) : null}

        {!isRegistered && step === 1 ? (
          <TermsStep
            onboarding={onboarding}
            disabled={false}
            saving={saveDraft.isPending}
            onNext={async (termsAccepted) => {
              setError(null);
              try {
                await saveDraft.mutateAsync({ termsAccepted, draftStep: 2 });
                toast.success('Términos guardados.');
                setStep(2);
              } catch {
                setError('No se pudo guardar los términos.');
              }
            }}
          />
        ) : null}

        {!isRegistered && step === 2 ? (
          <ScheduleStep
            onboarding={onboarding}
            disabled={false}
            saving={saveDraft.isPending}
            onBack={() => setStep(1)}
            onNext={async (values) => {
              setError(null);
              try {
                await saveDraft.mutateAsync({ ...values, draftStep: 3 });
                toast.success('Horarios guardados.');
                setStep(3);
              } catch {
                setError('No se pudieron guardar los horarios.');
              }
            }}
          />
        ) : null}

        {!isRegistered && step === 3 ? (
          <AreaStep
            onboarding={onboarding}
            disabled={false}
            saving={saveDraft.isPending}
            onBack={() => setStep(2)}
            onNext={async (values) => {
              setError(null);
              try {
                await saveDraft.mutateAsync({ ...values, draftStep: 4 });
                toast.success('Área de trabajo guardada.');
                setStep(4);
              } catch {
                setError('No se pudo guardar el área.');
              }
            }}
          />
        ) : null}

        {!isRegistered && step === 4 ? (
          <RateStep
            onboarding={onboarding}
            disabled={false}
            saving={saveDraft.isPending}
            onBack={() => setStep(3)}
            onNext={async () => {
              setError(null);
              try {
                await saveDraft.mutateAsync({
                  ratesAccepted: true,
                  currency: 'USD',
                  draftStep: 5,
                });
                toast.success('Esquema de tarifas aceptado.');
                setStep(5);
              } catch {
                setError('No se pudo guardar la aceptación de tarifas.');
              }
            }}
          />
        ) : null}

        {!isRegistered && step === 5 ? (
          <PreviewStep
            onboarding={onboarding}
            submitting={submit.isPending}
            onBack={() => setStep(4)}
            onSubmit={async () => {
              setError(null);
              const current = onboarding;
              if (
                !current.termsAccepted ||
                !current.ratesAccepted ||
                (!current.unspecifiedSchedule && !current.weeklySlots.length) ||
                !current.workAreaLabel ||
                !current.workAreaCity ||
                !current.workAreaCountry ||
                current.coverageRadiusKm == null
              ) {
                setError('Completá todos los pasos antes de confirmar.');
                return;
              }
              try {
                await submit.mutateAsync({
                  termsAccepted: true,
                  ratesAccepted: true,
                  timezone: current.timezone,
                  weeklySlots: current.unspecifiedSchedule ? [] : current.weeklySlots,
                  unspecifiedSchedule: Boolean(current.unspecifiedSchedule),
                  workAreaLabel: current.workAreaLabel,
                  workAreaCity: current.workAreaCity,
                  workAreaCountry: current.workAreaCountry,
                  coverageRadiusKm: current.coverageRadiusKm,
                  currency: current.currency || 'USD',
                });
                toast.success('¡Ya sos agente de ConfiApp!');
              } catch {
                setError(
                  'No se pudo completar el alta de agente. Verificá tu identidad si aún no lo hiciste.',
                );
              }
            }}
          />
        ) : null}
      </motion.div>
    </div>
  );
}

function TermsStep({
  onboarding,
  disabled,
  saving,
  onNext,
}: {
  onboarding: AgentOnboarding;
  disabled: boolean;
  saving: boolean;
  onNext: (accepted: true) => Promise<void>;
}) {
  const { data: profileData } = useProfile();
  const profile = profileData?.profile;
  const identityVerified =
    Boolean(profile?.identityVerified) || profile?.kyc?.status === 'VERIFIED';

  const form = useZodForm(termsStepSchema, {
    defaultValues: { termsAccepted: onboarding.termsAccepted },
  });

  return (
    <section>
      <h3 className="ca-section-title">Aceptación de términos</h3>
      <p className="ca-section-lead">Versión {onboarding.termsVersion}</p>
      <div className="ca-agent-form-shell ca-onboarding-media">
        <div className="ca-onboarding-media__visual" aria-hidden="true">
          <img
            src="/landing/Files.png"
            alt=""
            width={512}
            height={512}
            decoding="async"
          />
        </div>
        <div className="ca-onboarding-media__body">
          {!identityVerified ? (
            <Alert variant="warning" className="mb-3">
              Para continuar necesitás tener la identidad verificada (DNI o pasaporte con las fotos
              requeridas).{' '}
              <Link to="/perfil?tab=settings#verificar-identidad">
                Ir a Configuración → Verificar identidad
              </Link>
            </Alert>
          ) : null}
          <pre className="ca-terms-box">{onboarding.termsText}</pre>
          <Form
            onSubmit={form.handleSubmit(async () => {
              if (!identityVerified) return;
              await onNext(true);
            })}
          >
            <Form.Check
              type="checkbox"
              id="termsAccepted"
              className="mb-3"
              label="Acepto los términos y condiciones del agente intermediario"
              checked={Boolean(form.watch('termsAccepted'))}
              disabled={disabled || !identityVerified}
              onChange={(event) =>
                form.setValue('termsAccepted', event.target.checked, {
                  shouldValidate: true,
                })
              }
            />
            {form.formState.errors.termsAccepted ? (
              <div className="text-danger small mb-3">
                {form.formState.errors.termsAccepted.message}
              </div>
            ) : null}
            <div className="ca-form-actions">
              <Button
                type="submit"
                className="ca-btn-primary"
                disabled={disabled || saving || !identityVerified}
              >
                {saving ? 'Guardando…' : 'Continuar'}
              </Button>
            </div>
          </Form>
        </div>
      </div>
    </section>
  );
}

function ScheduleStep({
  onboarding,
  disabled,
  saving,
  onBack,
  onNext,
}: {
  onboarding: AgentOnboarding;
  disabled: boolean;
  saving: boolean;
  onBack: () => void;
  onNext: (values: ScheduleStepValues) => Promise<void>;
}) {
  const form = useZodForm(scheduleStepSchema, {
    defaultValues: {
      timezone: onboarding.timezone,
      unspecifiedSchedule: onboarding.unspecifiedSchedule === true,
      weeklySlots: onboarding.weeklySlots.length
        ? onboarding.weeklySlots
        : [{ dayOfWeek: 'MONDAY', startTime: '09:00', endTime: '13:00' }],
    },
  });

  const slots = form.watch('weeklySlots');
  const unspecifiedSchedule = Boolean(form.watch('unspecifiedSchedule'));
  const slotsDisabled = disabled || unspecifiedSchedule;

  const addSlot = () => {
    if (unspecifiedSchedule) return;
    const next: AgentScheduleSlot[] = [
      ...(slots ?? []),
      { dayOfWeek: 'TUESDAY', startTime: '14:00', endTime: '18:00' },
    ];
    form.setValue('weeklySlots', next, { shouldValidate: true });
  };

  const removeSlot = (index: number) => {
    if (unspecifiedSchedule) return;
    form.setValue(
      'weeklySlots',
      (slots ?? []).filter((_, i) => i !== index),
      { shouldValidate: true },
    );
  };

  return (
    <section>
      <h3 className="ca-section-title">Configuración de horarios</h3>
      <p className="ca-section-lead">Definí tu disponibilidad semanal como intermediario.</p>
      <div className="ca-agent-form-shell ca-onboarding-media">
        <div className="ca-onboarding-media__visual" aria-hidden="true">
          <img
            src="/landing/TimeManagement.png"
            alt=""
            width={512}
            height={512}
            decoding="async"
          />
        </div>
        <div className="ca-onboarding-media__body">
          <Form
            onSubmit={form.handleSubmit(async (values) => {
              await onNext({
                ...values,
                weeklySlots: values.unspecifiedSchedule ? [] : values.weeklySlots,
              });
            })}
            className="ca-form-grid"
          >
            <div className="row g-3 ca-form-grid__full">
              <Form.Group controlId="timezone" className="col-12 col-md-8">
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
                      disabled={disabled}
                    />
                  )}
                />
              </Form.Group>
              <Form.Group
                controlId="unspecifiedSchedule"
                className="col-12 col-md-4 d-flex align-items-end"
              >
                <Form.Check
                  type="switch"
                  id="unspecifiedSchedule"
                  label="No especificar horario"
                  checked={unspecifiedSchedule}
                  disabled={disabled}
                  onChange={(event) => {
                    form.setValue('unspecifiedSchedule', event.target.checked, {
                      shouldValidate: true,
                    });
                  }}
                />
              </Form.Group>
            </div>

            {unspecifiedSchedule ? (
              <p className="ca-form-grid__full text-muted small mb-0">
                Vas a recibir notificaciones de trabajo las 24 horas.
              </p>
            ) : null}

            <div className="ca-form-grid__full">
              {(slots ?? []).map((slot, index) => (
                <div key={`${slot.dayOfWeek}-${index}`} className="ca-slot-row">
                  <Form.Select
                    value={slot.dayOfWeek}
                    disabled={slotsDisabled}
                    onChange={(event) => {
                      const next = [...(slots ?? [])];
                      next[index] = {
                        ...next[index]!,
                        dayOfWeek: event.target.value as AgentScheduleSlot['dayOfWeek'],
                      };
                      form.setValue('weeklySlots', next, { shouldValidate: true });
                    }}
                  >
                    {DAYS.map((day) => (
                      <option key={day} value={day}>
                        {DAY_LABELS[day]}
                      </option>
                    ))}
                  </Form.Select>
                  <Form.Control
                    type="time"
                    value={slot.startTime}
                    disabled={slotsDisabled}
                    onChange={(event) => {
                      const next = [...(slots ?? [])];
                      next[index] = { ...next[index]!, startTime: event.target.value };
                      form.setValue('weeklySlots', next, { shouldValidate: true });
                    }}
                  />
                  <Form.Control
                    type="time"
                    value={slot.endTime}
                    disabled={slotsDisabled}
                    onChange={(event) => {
                      const next = [...(slots ?? [])];
                      next[index] = { ...next[index]!, endTime: event.target.value };
                      form.setValue('weeklySlots', next, { shouldValidate: true });
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline-danger"
                    disabled={slotsDisabled || (slots?.length ?? 0) <= 1}
                    onClick={() => removeSlot(index)}
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              ))}
              {form.formState.errors.weeklySlots ? (
                <div className="text-danger small">
                  {form.formState.errors.weeklySlots.message as string}
                </div>
              ) : null}
              <Button
                type="button"
                variant="outline-primary"
                className="mt-2"
                disabled={slotsDisabled}
                onClick={addSlot}
              >
                <Plus size={16} className="me-1" />
                Agregar franja
              </Button>
            </div>

            <div className="ca-form-actions ca-form-grid__full">
              <Button type="button" variant="outline-secondary" onClick={onBack}>
                Atrás
              </Button>
              <Button type="submit" className="ca-btn-primary" disabled={disabled || saving}>
                {saving ? 'Guardando…' : 'Continuar'}
              </Button>
            </div>
          </Form>
        </div>
      </div>
    </section>
  );
}

function AreaStep({
  onboarding,
  disabled,
  saving,
  onBack,
  onNext,
}: {
  onboarding: AgentOnboarding;
  disabled: boolean;
  saving: boolean;
  onBack: () => void;
  onNext: (values: AreaStepValues) => Promise<void>;
}) {
  const { distanceUnit } = useUserPreferences();
  const form = useZodForm(areaStepSchema, {
    defaultValues: {
      workAreaLabel: onboarding.workAreaLabel ?? '',
      workAreaCity: onboarding.workAreaCity ?? '',
      workAreaCountry: onboarding.workAreaCountry ?? 'UY',
      coverageRadiusKm: onboarding.coverageRadiusKm ?? 10,
    },
  });

  const coverageKm = form.watch('coverageRadiusKm');
  const maxDisplay = distanceUnit === 'MI' ? 62 : 100;
  const minDisplay = distanceUnit === 'MI' ? 1 : 1;

  return (
    <section>
      <h3 className="ca-section-title">Área de trabajo y cobertura</h3>
      <p className="ca-section-lead">Zona donde podés mediar encuentros presenciales.</p>
      <div className="ca-agent-form-shell ca-onboarding-media">
        <div className="ca-onboarding-media__visual" aria-hidden="true">
          <img
            src="/landing/Map.png"
            alt=""
            width={512}
            height={512}
            decoding="async"
          />
        </div>
        <div className="ca-onboarding-media__body">
          <Form onSubmit={form.handleSubmit(onNext)}>
            <div className="row g-3">
              <Form.Group controlId="workAreaLabel" className="col-12 col-md-4">
                <Form.Label>Área / barrio</Form.Label>
                <Form.Control
                  {...form.register('workAreaLabel')}
                  disabled={disabled}
                  isInvalid={Boolean(form.formState.errors.workAreaLabel)}
                />
                <Form.Control.Feedback type="invalid">
                  {form.formState.errors.workAreaLabel?.message}
                </Form.Control.Feedback>
              </Form.Group>
              <Form.Group controlId="workAreaCity" className="col-12 col-md-4">
                <Form.Label>Ciudad</Form.Label>
                <Controller
                  name="workAreaCity"
                  control={form.control}
                  render={({ field }) => (
                    <UruguayCitySelect
                      id="workAreaCity"
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      disabled={disabled}
                      invalid={Boolean(form.formState.errors.workAreaCity)}
                    />
                  )}
                />
                {form.formState.errors.workAreaCity ? (
                  <div className="invalid-feedback d-block">
                    {form.formState.errors.workAreaCity.message}
                  </div>
                ) : null}
              </Form.Group>
              <Form.Group controlId="workAreaCountry" className="col-12 col-md-4">
                <Form.Label>País</Form.Label>
                <Controller
                  name="workAreaCountry"
                  control={form.control}
                  render={({ field }) => (
                    <CountrySelect
                      id="workAreaCountry"
                      variant="name"
                      value={field.value || 'UY'}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      disabled={disabled}
                      invalid={Boolean(form.formState.errors.workAreaCountry)}
                    />
                  )}
                />
                {form.formState.errors.workAreaCountry ? (
                  <div className="invalid-feedback d-block">
                    {form.formState.errors.workAreaCountry.message}
                  </div>
                ) : null}
              </Form.Group>

              <Form.Group controlId="coverageRadiusKm" className="col-12">
                <Form.Label>Radio de cobertura ({distanceUnitLabel(distanceUnit)})</Form.Label>
                <div className="row g-2 align-items-center ca-coverage-row">
                  <div className="col-10">
                    <Form.Range
                      min={minDisplay}
                      max={maxDisplay}
                      disabled={disabled}
                      value={Number(fromKm(coverageKm, distanceUnit).toFixed(0))}
                      onChange={(event) =>
                        form.setValue(
                          'coverageRadiusKm',
                          toKm(Number(event.target.value), distanceUnit),
                          { shouldValidate: true },
                        )
                      }
                    />
                  </div>
                  <div className="col-2">
                    <div className="ca-range-value" aria-live="polite">
                      {formatDistance(coverageKm, distanceUnit, 0)}
                    </div>
                  </div>
                </div>
              </Form.Group>

              <div className="col-12 ca-form-actions">
                <Button type="button" variant="outline-secondary" onClick={onBack}>
                  Atrás
                </Button>
                <Button type="submit" className="ca-btn-primary" disabled={disabled || saving}>
                  {saving ? 'Guardando…' : 'Continuar'}
                </Button>
              </div>
            </div>
          </Form>
        </div>
      </div>
    </section>
  );
}

function RateStep({
  onboarding,
  disabled,
  saving,
  onBack,
  onNext,
}: {
  onboarding: AgentOnboarding;
  disabled: boolean;
  saving: boolean;
  onBack: () => void;
  onNext: () => Promise<void>;
}) {
  const form = useZodForm(rateStepSchema, {
    defaultValues: { ratesAccepted: onboarding.ratesAccepted },
  });

  return (
    <section>
      <h3 className="ca-section-title">Tarifa de intermediación</h3>
      <p className="ca-section-lead">
        La tarifa la define ConfiApp según el valor del producto. Acá te explicamos cómo se calcula
        y cómo se reparte.
      </p>
      <div className="ca-agent-form-shell ca-onboarding-media">
        <div className="ca-onboarding-media__visual" aria-hidden="true">
          <img
            src="/landing/Finance.png"
            alt=""
            width={512}
            height={512}
            decoding="async"
          />
        </div>
        <div className="ca-onboarding-media__body">
          <div className="ca-rates-copy">
            <p>
              La tarifa es dinámica y depende del valor del producto de la operación:
            </p>
            <ul className="ca-rates-tiers">
              <li>
                <strong>Hasta USD $200</strong> (doscientos dólares americanos): la tarifa para los
                usuarios será de <strong>USD $10</strong> (diez dólares americanos).
              </li>
              <li>
                <strong>De USD $200 a USD $600</strong> (doscientos a seiscientos dólares
                americanos): la tarifa será de <strong>USD $15</strong> (quince dólares americanos).
              </li>
              <li>
                <strong>De USD $600 a USD $1.200</strong> (seiscientos a mil doscientos dólares
                americanos): la tarifa será de <strong>USD $20</strong> (veinte dólares americanos).
              </li>
              <li>
                <strong>De USD $1.200 a USD $2.000</strong> (mil doscientos a dos mil dólares
                americanos): la tarifa será de <strong>USD $25</strong> (veinticinco dólares
                americanos).
              </li>
              <li>
                <strong>De USD $2.000 en adelante</strong> (dos mil dólares americanos): la tarifa
                será de <strong>USD $35</strong> (treinta y cinco dólares americanos).
              </li>
            </ul>
            <p>
              De esa tarifa, el reparto es del <strong>80%</strong> (ochenta por ciento) para el
              Agente y del <strong>20%</strong> (veinte por ciento) para ConfiApp.
            </p>
            <p>
              Todos los impuestos que se generen por el cobro del servicio de ConfiApp serán a cargo
              de la aplicación y no del Agente.
            </p>
            <p>
              Los usuarios podrán sumar más dinero a los montos mencionados para persuadir a los
              Agentes a tomar sus intercambios antes que otros. Sobre esos montos adicionales se
              mantienen los mismos porcentajes de reparto.
            </p>
          </div>

          <Form
            onSubmit={form.handleSubmit(async () => {
              await onNext();
            })}
          >
            <Form.Check
              type="checkbox"
              id="ratesAccepted"
              className="mb-3"
              label="Entiendo y acepto el esquema de tarifas de intermediación de ConfiApp"
              checked={Boolean(form.watch('ratesAccepted'))}
              disabled={disabled}
              onChange={(event) =>
                form.setValue('ratesAccepted', event.target.checked, {
                  shouldValidate: true,
                })
              }
            />
            {form.formState.errors.ratesAccepted ? (
              <div className="text-danger small mb-3">
                {form.formState.errors.ratesAccepted.message}
              </div>
            ) : null}
            <div className="ca-form-actions">
              <Button type="button" variant="outline-secondary" onClick={onBack}>
                Atrás
              </Button>
              <Button type="submit" className="ca-btn-primary" disabled={disabled || saving}>
                {saving ? 'Guardando…' : 'Continuar'}
              </Button>
            </div>
          </Form>
        </div>
      </div>
    </section>
  );
}

function PreviewStep({
  onboarding,
  submitting,
  onBack,
  onSubmit,
}: {
  onboarding: AgentOnboarding;
  submitting: boolean;
  onBack: () => void;
  onSubmit: () => Promise<void>;
}) {
  const { distanceUnit } = useUserPreferences();
  const slotsLabel = useMemo(() => {
    if (onboarding.unspecifiedSchedule) return 'Disponible 24 h';
    return onboarding.weeklySlots
      .map(
        (slot) =>
          `${DAY_LABELS[slot.dayOfWeek] ?? slot.dayOfWeek} ${slot.startTime}–${slot.endTime}`,
      )
      .join(' · ');
  }, [onboarding.unspecifiedSchedule, onboarding.weeklySlots]);

  return (
    <section>
      <h3 className="ca-section-title">Vista previa</h3>
      <p className="ca-section-lead">Revisá todo antes de confirmar tu alta como agente.</p>

      <div className="ca-agent-form-shell ca-onboarding-media">
        <div className="ca-onboarding-media__visual" aria-hidden="true">
          <img
            src="/landing/Folder.png"
            alt=""
            width={512}
            height={512}
            decoding="async"
          />
        </div>
        <div className="ca-onboarding-media__body">
          <div className="ca-preview-card">
            <p className="ca-preview-card__name">{onboarding.preview.fullName}</p>
            <p className="ca-preview-card__email">{onboarding.preview.email}</p>
            <p className="ca-preview-card__summary">{onboarding.preview.summary}</p>
            <dl className="ca-preview-list">
              <div>
                <dt>Términos</dt>
                <dd>
                  {onboarding.termsAccepted
                    ? `Aceptados (v${onboarding.termsVersion})`
                    : 'Pendientes'}
                </dd>
              </div>
              <div>
                <dt>Horarios</dt>
                <dd>{slotsLabel || 'Sin franjas'}</dd>
              </div>
              <div>
                <dt>Área</dt>
                <dd>
                  {onboarding.workAreaLabel} · {onboarding.workAreaCity},{' '}
                  {onboarding.workAreaCountry}
                </dd>
              </div>
              <div>
                <dt>Radio</dt>
                <dd>
                  {onboarding.coverageRadiusKm != null
                    ? formatDistance(onboarding.coverageRadiusKm, distanceUnit, 0)
                    : '—'}
                </dd>
              </div>
              <div>
                <dt>Tarifa</dt>
                <dd>
                  {onboarding.ratesAccepted
                    ? 'Esquema de plataforma aceptado (80% agente / 20% ConfiApp)'
                    : 'Pendiente'}
                </dd>
              </div>
            </dl>
          </div>

          <div className="ca-form-actions">
            <Button type="button" variant="outline-secondary" onClick={onBack}>
              Atrás
            </Button>
            <Button
              type="button"
              className="ca-btn-cta"
              disabled={submitting}
              onClick={() => void onSubmit()}
            >
              {submitting ? 'Confirmando…' : 'Confirmar y convertirme en agente'}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
