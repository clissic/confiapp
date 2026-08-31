import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Form, Spinner } from 'react-bootstrap';
import { Controller } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, Trash2 } from 'lucide-react';

import { useZodForm } from '@/shared/lib/form';
import { distanceUnitLabel, formatDistance, fromKm, toKm } from '@/shared/lib/distance';
import { useUserPreferences } from '@/shared/preferences';
import { useAppToast } from '@/shared/ui';
import { ApiClientError } from '@/shared/api/client';
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
import { geocodeCity, reverseGeocodeLabel, WorkAreaMapPicker } from './WorkAreaMapPicker';
import '../styles/agent-onboarding.css';

const STEPS = [
  {
    id: 1,
    label: 'Términos',
    title: 'Términos del intermediario',
    lead: 'Leé y aceptá las condiciones para operar como Agente.',
  },
  {
    id: 2,
    label: 'Horarios',
    title: 'Disponibilidad',
    lead: 'Definí tu zona horaria y franjas para recibir trabajos.',
  },
  {
    id: 3,
    label: 'Área',
    title: 'Área de trabajo',
    lead: 'País, ciudad, centro en el mapa y radio de cobertura.',
  },
  {
    id: 4,
    label: 'Tarifa',
    title: 'Tarifa de intermediación',
    lead: 'Cómo se calcula y reparte la comisión de ConfiApp.',
  },
  {
    id: 5,
    label: 'Revisar',
    title: 'Revisar y confirmar',
    lead: 'Confirmá tus datos antes de activar tu perfil de Agente.',
  },
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

  const currentStep = STEPS.find((item) => item.id === step) ?? STEPS[0]!;

  if (isRegistered) {
    return (
      <div className="ca-agent-flow ca-agent-flow--agency">
        {error ? <Alert variant="danger">{error}</Alert> : null}

        <motion.div
          key={`agency-${editSection ?? 'summary'}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
        >
          {editSection === 'schedule' ? (
            <>
              <header className="ca-agent-wizard__step-head mb-3">
                <h2 className="ca-agent-wizard__step-title">Disponibilidad</h2>
                <p className="ca-agent-wizard__step-lead">
                  Actualizá tu zona horaria y franjas para recibir trabajos.
                </p>
              </header>
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
            </>
          ) : null}

          {editSection === 'area' ? (
            <>
              <header className="ca-agent-wizard__step-head mb-3">
                <h2 className="ca-agent-wizard__step-title">Área de trabajo</h2>
                <p className="ca-agent-wizard__step-lead">
                  País, ciudad, centro en el mapa y radio de cobertura.
                </p>
              </header>
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
            </>
          ) : null}

          {!editSection ? (
            <AgentAgencyPanel
              onboarding={onboarding}
              busy={busy}
              onEditSchedule={() => setEditSection('schedule')}
              onEditArea={() => setEditSection('area')}
              onSuspend={async () => {
                setError(null);
                try {
                  await suspend.mutateAsync();
                  toast.success(
                    'Actividad suspendida. No recibís trabajos nuevos; seguís a cargo de las operaciones en curso.',
                  );
                } catch {
                  setError('No se pudo suspender la actividad.');
                }
              }}
              onResume={async () => {
                setError(null);
                try {
                  await resume.mutateAsync();
                  toast.success('Volviste a estar disponible para nuevos trabajos.');
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
                } catch (err) {
                  if (err instanceof ApiClientError && err.code === 'ACTIVE_JOBS') {
                    const count =
                      typeof err.details === 'object' &&
                      err.details &&
                      'count' in err.details &&
                      typeof (err.details as { count?: unknown }).count === 'number'
                        ? (err.details as { count: number }).count
                        : onboarding.activeJobsCount ?? 0;
                    setError(
                      `No podés cerrar la agencia: tenés ${count} operación${count === 1 ? '' : 'es'} activa${count === 1 ? '' : 's'}. Solicitá la salida desde cada operación o completá el trabajo.`,
                    );
                    toast.error('Cierre bloqueado: hay operaciones activas.');
                    return;
                  }
                  setError('No se pudo cerrar la agencia.');
                }
              }}
            />
          ) : null}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="ca-agent-flow ca-agent-flow--wizard">
      <header className="ca-agent-wizard__intro">
        <h1 className="ca-agent-wizard__heading">Onboarding de intermediario</h1>
      </header>

      <nav className="ca-agent-wizard__steps-wrap" aria-label="Pasos del onboarding">
        <ol className="ca-agent-steps ca-agent-wizard__steps">
          {STEPS.map((item) => {
            const done = step > item.id;
            const active = step === item.id;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  className={[
                    'ca-agent-steps__item',
                    active ? 'ca-agent-steps__item--active' : '',
                    done ? 'ca-agent-steps__item--done' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  disabled={item.id > step}
                  aria-current={active ? 'step' : undefined}
                  onClick={() => {
                    if (item.id < step) setStep(item.id);
                  }}
                >
                  <span className="ca-agent-steps__num">{item.id}</span>
                  <span className="ca-agent-steps__label">{item.label}</span>
                </button>
              </li>
            );
          })}
        </ol>
        <p className="ca-agent-steps__current" aria-live="polite">
          Paso {step} de {STEPS.length} · {currentStep.label}
        </p>
      </nav>

      {error ? <Alert variant="danger">{error}</Alert> : null}

      <header className="ca-agent-wizard__step-head">
        <h2 className="ca-agent-wizard__step-title">{currentStep.title}</h2>
        <p className="ca-agent-wizard__step-lead">{currentStep.lead}</p>
      </header>

      <motion.div
        key={step}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="ca-agent-wizard__panel"
      >
        {step === 1 ? (
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

        {step === 2 ? (
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

        {step === 3 ? (
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

        {step === 4 ? (
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
                  currency: 'UYU',
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

        {step === 5 ? (
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
                current.workAreaLat == null ||
                current.workAreaLng == null ||
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
                  workAreaLat: current.workAreaLat,
                  workAreaLng: current.workAreaLng,
                  coverageRadiusKm: current.coverageRadiusKm,
                  currency: current.currency || 'UYU',
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
    <Form
      className="ca-agent-wizard__stack"
      onSubmit={form.handleSubmit(async () => {
        if (!identityVerified) return;
        await onNext(true);
      })}
    >
      <p className="ca-agent-wizard__meta text-muted small mb-0">
        Versión {onboarding.termsVersion}
      </p>

      {!identityVerified ? (
        <Alert variant="warning" className="mb-0">
          Para continuar necesitás tener la identidad verificada (DNI o pasaporte con las fotos
          requeridas).{' '}
          <Link to="/perfil?tab=settings#verificar-identidad">
            Ir a Configuración → Verificar identidad
          </Link>
        </Alert>
      ) : null}

      <pre className="ca-terms-box">{onboarding.termsText}</pre>

      <Form.Check
        type="checkbox"
        id="termsAccepted"
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
        <div className="text-danger small">{form.formState.errors.termsAccepted.message}</div>
      ) : null}

      <div className="ca-agent-wizard__actions">
        <span />
        <Button
          type="submit"
          className="ca-btn-cta"
          disabled={disabled || saving || !identityVerified}
        >
          {saving ? 'Guardando…' : 'Continuar'}
        </Button>
      </div>
    </Form>
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
      timezone:
        onboarding.isAgent || onboarding.draftStep >= 3
          ? onboarding.timezone || 'America/Montevideo'
          : 'America/Montevideo',
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
    <Form
      className="ca-agent-wizard__stack"
      onSubmit={form.handleSubmit(async (values) => {
        await onNext({
          ...values,
          weeklySlots: values.unspecifiedSchedule ? [] : values.weeklySlots,
        });
      })}
    >
      <div className="row g-3">
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
        <p className="text-muted small mb-0">
          Vas a recibir notificaciones de trabajo las 24 horas.
        </p>
      ) : null}

      <div className="ca-agent-wizard__slots">
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
          disabled={slotsDisabled}
          onClick={addSlot}
        >
          <Plus size={16} className="me-1" />
          Agregar franja
        </Button>
      </div>

      <div className="ca-agent-wizard__actions">
        <Button type="button" variant="outline-secondary" onClick={onBack}>
          Atrás
        </Button>
        <Button type="submit" className="ca-btn-cta" disabled={disabled || saving}>
          {saving ? 'Guardando…' : 'Continuar'}
        </Button>
      </div>
    </Form>
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
  onNext: (values: {
    workAreaLabel: string;
    workAreaCity: string;
    workAreaCountry: string;
    workAreaLat: number;
    workAreaLng: number;
    coverageRadiusKm: number;
  }) => Promise<void>;
}) {
  const { distanceUnit } = useUserPreferences();
  const form = useZodForm(areaStepSchema, {
    defaultValues: {
      workAreaLabel: onboarding.workAreaLabel ?? '',
      workAreaCity: onboarding.workAreaCity ?? '',
      workAreaCountry: onboarding.workAreaCountry ?? 'UY',
      workAreaLat: onboarding.workAreaLat ?? null,
      workAreaLng: onboarding.workAreaLng ?? null,
      coverageRadiusKm: onboarding.coverageRadiusKm ?? 10,
    },
  });

  const [mapHint, setMapHint] = useState<string | null>(null);
  const [geoBusy, setGeoBusy] = useState(false);
  const [mapFocus, setMapFocus] = useState<{
    lat: number;
    lng: number;
    zoom: number;
    key: number;
  } | null>(
    onboarding.workAreaLat != null && onboarding.workAreaLng != null
      ? {
          lat: onboarding.workAreaLat,
          lng: onboarding.workAreaLng,
          zoom: 13,
          key: 1,
        }
      : null,
  );
  const lastGeocodedCity = useRef(
    onboarding.workAreaCity && onboarding.workAreaCountry
      ? `${onboarding.workAreaCountry}|${onboarding.workAreaCity}`
      : '',
  );

  const city = form.watch('workAreaCity');
  const country = form.watch('workAreaCountry');
  const lat = form.watch('workAreaLat');
  const lng = form.watch('workAreaLng');
  const label = form.watch('workAreaLabel');
  const coverageKm = form.watch('coverageRadiusKm') ?? 10;

  const cityReady = Boolean(city?.trim() && country);
  const pinReady = lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng);
  const maxDisplay = distanceUnit === 'MI' ? 62 : 100;
  const minDisplay = 1;

  const applyCenter = async (
    nextLat: number,
    nextLng: number,
    fallbackLabel: string,
    options?: { flyTo?: boolean },
  ) => {
    form.setValue('workAreaLat', nextLat, { shouldValidate: true, shouldDirty: true });
    form.setValue('workAreaLng', nextLng, { shouldValidate: true, shouldDirty: true });
    if (options?.flyTo) {
      setMapFocus((prev) => ({
        lat: nextLat,
        lng: nextLng,
        zoom: 13,
        key: (prev?.key ?? 0) + 1,
      }));
    }
    setMapHint(null);
    try {
      const resolved = await reverseGeocodeLabel(nextLat, nextLng);
      form.setValue('workAreaLabel', resolved || fallbackLabel, { shouldValidate: true });
    } catch {
      form.setValue('workAreaLabel', fallbackLabel, { shouldValidate: true });
    }
  };

  useEffect(() => {
    if (!cityReady || disabled) return;
    const geoKey = `${country}|${city}`;
    if (lastGeocodedCity.current === geoKey) return;

    // Si ya hay un centro guardado para esta ciudad, no lo pisamos.
    if (
      pinReady &&
      onboarding.workAreaCity === city &&
      onboarding.workAreaCountry === country &&
      onboarding.workAreaLat != null &&
      onboarding.workAreaLng != null
    ) {
      lastGeocodedCity.current = geoKey;
      return;
    }

    let cancelled = false;
    setGeoBusy(true);
    void (async () => {
      try {
        const point = await geocodeCity(city!.trim(), country!);
        if (cancelled || !point) {
          if (!cancelled && !point) {
            setMapHint('No encontramos esa ciudad. Probá otra o marcá el mapa a mano.');
          }
          return;
        }
        lastGeocodedCity.current = geoKey;
        await applyCenter(point.lat, point.lng, city!.trim(), { flyTo: true });
      } catch {
        if (!cancelled) {
          setMapHint('No se pudo ubicar la ciudad. Marcá el centro en el mapa.');
        }
      } finally {
        if (!cancelled) setGeoBusy(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city, country, cityReady, disabled]);

  const clearPin = () => {
    form.setValue('workAreaLat', null);
    form.setValue('workAreaLng', null);
    form.setValue('workAreaLabel', '');
    lastGeocodedCity.current = '';
    setMapHint(null);
  };

  return (
    <Form
      className="ca-agent-wizard__stack ca-work-area"
      onSubmit={form.handleSubmit(async (values: AreaStepValues) => {
        if (values.workAreaLat == null || values.workAreaLng == null) {
          setMapHint('Tocá el mapa para marcar el centro de tu cobertura.');
          return;
        }
        await onNext({
          workAreaLabel: values.workAreaLabel,
          workAreaCity: values.workAreaCity,
          workAreaCountry: values.workAreaCountry,
          workAreaLat: values.workAreaLat,
          workAreaLng: values.workAreaLng,
          coverageRadiusKm: values.coverageRadiusKm,
        });
      })}
    >
      <div className="row g-3">
        <Form.Group controlId="workAreaCountry" className="col-12 col-sm-6">
          <Form.Label>País</Form.Label>
          <Controller
            name="workAreaCountry"
            control={form.control}
            render={({ field }) => (
              <CountrySelect
                id="workAreaCountry"
                variant="name"
                value={field.value || 'UY'}
                onChange={(next) => {
                  field.onChange(next);
                  form.setValue('workAreaCity', '');
                  clearPin();
                }}
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

        <Form.Group controlId="workAreaCity" className="col-12 col-sm-6">
          <Form.Label>Ciudad</Form.Label>
          <Controller
            name="workAreaCity"
            control={form.control}
            render={({ field }) => (
              <UruguayCitySelect
                id="workAreaCity"
                value={field.value ?? ''}
                onChange={(next) => {
                  field.onChange(next);
                  clearPin();
                }}
                onBlur={field.onBlur}
                disabled={disabled || !country}
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
      </div>

      <div>
        <div className="ca-work-area__map-head">
          <div>
            <p className="ca-work-area__map-title mb-0">Centro de cobertura</p>
            <p className="ca-work-area__map-hint mb-0">
              {!cityReady
                ? 'Elegí país y ciudad para empezar.'
                : geoBusy
                  ? 'Buscando la ciudad en el mapa…'
                  : 'Tocá el mapa o arrastrá el pin para afinar el centro.'}
            </p>
          </div>
          {pinReady && label ? <span className="ca-work-area__chip">{label}</span> : null}
        </div>

        <WorkAreaMapPicker
          canPick={cityReady && !disabled}
          disabled={disabled}
          lat={pinReady ? lat : null}
          lng={pinReady ? lng : null}
          radiusKm={coverageKm}
          focus={mapFocus}
          onPick={(nextLat, nextLng) => {
            void applyCenter(nextLat, nextLng, city || 'Cobertura');
          }}
        />

        {mapHint ? (
          <Alert variant="warning" className="mt-2 mb-0">
            {mapHint}
          </Alert>
        ) : null}
        {form.formState.errors.workAreaLat ? (
          <div className="invalid-feedback d-block">
            {form.formState.errors.workAreaLat.message}
          </div>
        ) : null}
      </div>

      <Form.Group controlId="coverageRadiusKm">
        <Form.Label>Radio de cobertura ({distanceUnitLabel(distanceUnit)})</Form.Label>
        <div className="row g-2 align-items-center ca-coverage-row">
          <div className="col-10">
            <Form.Range
              min={minDisplay}
              max={maxDisplay}
              disabled={disabled || !pinReady}
              value={Number(fromKm(coverageKm, distanceUnit).toFixed(0))}
              onChange={(event) =>
                form.setValue('coverageRadiusKm', toKm(Number(event.target.value), distanceUnit), {
                  shouldValidate: true,
                })
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

      <div className="ca-agent-wizard__actions">
        <Button type="button" variant="outline-secondary" onClick={onBack}>
          Atrás
        </Button>
        <Button
          type="submit"
          className="ca-btn-cta"
          disabled={disabled || saving || !pinReady}
        >
          {saving ? 'Guardando…' : 'Continuar'}
        </Button>
      </div>
    </Form>
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
    <Form
      className="ca-agent-wizard__stack"
      onSubmit={form.handleSubmit(async () => {
        await onNext();
      })}
    >
      <div className="ca-rates-copy">
        <p>La tarifa es dinámica y depende del valor del producto de la operación:</p>
        <ul className="ca-rates-tiers">
          <li>
            <strong>Hasta UYU $8.000</strong> (ocho mil pesos uruguayos): la tarifa para los
            usuarios será de <strong>UYU $400</strong> (cuatrocientos pesos uruguayos).
          </li>
          <li>
            <strong>De UYU $8.000 a UYU $24.000</strong> (ocho mil a veinticuatro mil pesos
            uruguayos): la tarifa será de <strong>UYU $600</strong> (seiscientos pesos uruguayos).
          </li>
          <li>
            <strong>De UYU $24.000 a UYU $48.000</strong> (veinticuatro mil a cuarenta y ocho mil
            pesos uruguayos): la tarifa será de <strong>UYU $800</strong> (ochocientos pesos
            uruguayos).
          </li>
          <li>
            <strong>De UYU $48.000 a UYU $80.000</strong> (cuarenta y ocho mil a ochenta mil pesos
            uruguayos): la tarifa será de <strong>UYU $1.000</strong> (mil pesos uruguayos).
          </li>
          <li>
            <strong>De UYU $80.000 en adelante</strong> (ochenta mil pesos uruguayos): la tarifa
            será de <strong>UYU $1.400</strong> (mil cuatrocientos pesos uruguayos).
          </li>
        </ul>
        <p>
          De esa tarifa, el reparto es del <strong>80%</strong> (ochenta por ciento) para el Agente
          y del <strong>20%</strong> (veinte por ciento) para ConfiApp.
        </p>
        <p>
          Tras completar una operación, tu participación queda <strong>pendiente 21 días</strong>.
          Luego pasa a disponible. Las transferencias del saldo disponible las realiza un
          administrador de ConfiApp <strong>del 1 al 10 de cada mes</strong> (liquidación manual; no
          hay retiro automático).
        </p>
        <p>
          Todos los impuestos que se generen por el cobro del servicio de ConfiApp serán a cargo de
          la aplicación y no del Agente.
        </p>
        <p>
          Los usuarios podrán sumar más dinero a los montos mencionados para persuadir a los Agentes
          a tomar sus intercambios antes que otros. Sobre esos montos adicionales se mantienen los
          mismos porcentajes de reparto.
        </p>
      </div>

      <Form.Check
        type="checkbox"
        id="ratesAccepted"
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
        <div className="text-danger small">{form.formState.errors.ratesAccepted.message}</div>
      ) : null}

      <div className="ca-agent-wizard__actions">
        <Button type="button" variant="outline-secondary" onClick={onBack}>
          Atrás
        </Button>
        <Button type="submit" className="ca-btn-cta" disabled={disabled || saving}>
          {saving ? 'Guardando…' : 'Continuar'}
        </Button>
      </div>
    </Form>
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

  const areaLabel = [onboarding.workAreaLabel, onboarding.workAreaCity, onboarding.workAreaCountry]
    .filter(Boolean)
    .join(' · ');

  const radiusLabel =
    onboarding.coverageRadiusKm != null
      ? formatDistance(onboarding.coverageRadiusKm, distanceUnit, 0)
      : '—';

  const facts = [
    {
      label: 'Términos',
      value: onboarding.termsAccepted
        ? `Aceptados (v${onboarding.termsVersion})`
        : 'Pendientes',
    },
    {
      label: 'Horarios',
      value: slotsLabel || 'Sin franjas',
    },
    {
      label: 'Área',
      value: areaLabel || '—',
    },
    {
      label: 'Radio',
      value: radiusLabel,
    },
    {
      label: 'Tarifa',
      value: onboarding.ratesAccepted
        ? 'Esquema de plataforma (80% agente / 20% ConfiApp)'
        : 'Pendiente',
    },
  ];

  return (
    <div className="ca-agent-wizard__stack ca-agent-preview">
      <div className="ca-agent-preview__identity">
        <p className="ca-agent-preview__name">{onboarding.preview.fullName}</p>
        <p className="ca-agent-preview__email">{onboarding.preview.email}</p>
      </div>

      <dl className="ca-agent-preview__review">
        {facts.map((fact) => (
          <div key={fact.label} className="ca-agent-preview__fact">
            <dt>{fact.label}</dt>
            <dd>{fact.value}</dd>
          </div>
        ))}
      </dl>

      <div className="ca-agent-wizard__actions">
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
  );
}
