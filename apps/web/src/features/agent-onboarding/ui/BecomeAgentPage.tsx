import { useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Form, Spinner } from 'react-bootstrap';
import { motion } from 'framer-motion';
import { CheckCircle2, Plus, ShieldCheck, Trash2 } from 'lucide-react';

import { useZodForm } from '@/shared/lib/form';

import { formatRate } from '../api/agent-onboarding.api';
import {
  useAgentOnboarding,
  useSaveAgentDraft,
  useSubmitAgentOnboarding,
} from '../hooks/useAgentOnboarding';
import {
  areaStepSchema,
  DAY_LABELS,
  DAYS,
  rateStepSchema,
  scheduleStepSchema,
  termsStepSchema,
  type AreaStepValues,
  type RateStepValues,
  type ScheduleStepValues,
} from '../model/schemas';
import type { AgentOnboarding, AgentScheduleSlot } from '../model/types';
import '../styles/agent-onboarding.css';

const STEPS = [
  { id: 1, label: 'Términos' },
  { id: 2, label: 'Horarios' },
  { id: 3, label: 'Área' },
  { id: 4, label: 'Tarifa' },
  { id: 5, label: 'Vista previa' },
] as const;

export function BecomeAgentPage() {
  const { data, isLoading, isError } = useAgentOnboarding();
  const saveDraft = useSaveAgentDraft();
  const submit = useSubmitAgentOnboarding();
  const [step, setStep] = useState(1);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onboarding = data?.data;

  useEffect(() => {
    if (onboarding?.draftStep) {
      setStep(onboarding.isAgent ? 5 : onboarding.draftStep);
    }
  }, [onboarding?.draftStep, onboarding?.isAgent]);

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

  return (
    <div className="ca-agent-flow">
      <header className="ca-agent-flow__header">
        <div className="ca-agent-flow__brand">
          <ShieldCheck size={22} strokeWidth={1.75} />
          <div>
            <p className="ca-agent-flow__kicker">Convertirse en agente</p>
            <h2 className="ca-agent-flow__title">Onboarding de intermediario</h2>
          </div>
        </div>
        <div className="ca-agent-flow__meta">
          <Badge bg="primary">{onboarding.status}</Badge>
          <Badge bg="light" text="dark">
            {data.source === 'demo' ? 'Modo demo' : 'API'}
          </Badge>
        </div>
      </header>

      <ol className="ca-agent-steps">
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
          >
            <span>{item.id}</span>
            {item.label}
          </li>
        ))}
      </ol>

      {feedback ? <Alert variant="success">{feedback}</Alert> : null}
      {error ? <Alert variant="danger">{error}</Alert> : null}

      {onboarding.isAgent ? (
        <Alert variant="success" className="d-flex align-items-center gap-2">
          <CheckCircle2 size={18} />
          Ya sos agente activo. Podés revisar tu configuración abajo.
        </Alert>
      ) : null}

      <motion.div
        key={step}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="ca-agent-panel"
      >
        {step === 1 ? (
          <TermsStep
            onboarding={onboarding}
            disabled={onboarding.isAgent}
            saving={saveDraft.isPending}
            onNext={async (termsAccepted) => {
              setError(null);
              try {
                await saveDraft.mutateAsync({ termsAccepted, draftStep: 2 });
                setFeedback('Términos guardados.');
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
            disabled={onboarding.isAgent}
            saving={saveDraft.isPending}
            onBack={() => setStep(1)}
            onNext={async (values) => {
              setError(null);
              try {
                await saveDraft.mutateAsync({ ...values, draftStep: 3 });
                setFeedback('Horarios guardados.');
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
            disabled={onboarding.isAgent}
            saving={saveDraft.isPending}
            onBack={() => setStep(2)}
            onNext={async (values) => {
              setError(null);
              try {
                await saveDraft.mutateAsync({ ...values, draftStep: 4 });
                setFeedback('Área de trabajo guardada.');
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
            disabled={onboarding.isAgent}
            saving={saveDraft.isPending}
            onBack={() => setStep(3)}
            onNext={async (values) => {
              setError(null);
              try {
                await saveDraft.mutateAsync({
                  hourlyRateCents: Math.round(values.hourlyRate * 100),
                  currency: values.currency,
                  draftStep: 5,
                });
                setFeedback('Tarifa guardada.');
                setStep(5);
              } catch {
                setError('No se pudo guardar la tarifa.');
              }
            }}
          />
        ) : null}

        {step === 5 ? (
          <PreviewStep
            onboarding={data.data}
            submitting={submit.isPending}
            onBack={() => setStep(4)}
            onSubmit={async () => {
              setError(null);
              setFeedback(null);
              const current = data.data;
              if (
                !current.termsAccepted ||
                !current.weeklySlots.length ||
                !current.workAreaLabel ||
                !current.workAreaCity ||
                !current.workAreaCountry ||
                current.coverageRadiusKm == null ||
                current.hourlyRateCents == null
              ) {
                setError('Completá todos los pasos antes de confirmar.');
                return;
              }
              try {
                await submit.mutateAsync({
                  termsAccepted: true,
                  timezone: current.timezone,
                  weeklySlots: current.weeklySlots,
                  workAreaLabel: current.workAreaLabel,
                  workAreaCity: current.workAreaCity,
                  workAreaCountry: current.workAreaCountry,
                  coverageRadiusKm: current.coverageRadiusKm,
                  hourlyRateCents: current.hourlyRateCents,
                  currency: current.currency,
                });
                setFeedback('¡Ya sos agente de ConfiApp!');
              } catch {
                setError('No se pudo completar el alta de agente.');
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
  const form = useZodForm(termsStepSchema, {
    defaultValues: { termsAccepted: onboarding.termsAccepted },
  });

  return (
    <section>
      <h3 className="ca-section-title">Aceptación de términos</h3>
      <p className="ca-section-lead">Versión {onboarding.termsVersion}</p>
      <pre className="ca-terms-box">{onboarding.termsText}</pre>
      <Form
        onSubmit={form.handleSubmit(async () => {
          await onNext(true);
        })}
      >
        <Form.Check
          type="checkbox"
          id="termsAccepted"
          className="mb-3"
          label="Acepto los términos y condiciones del agente intermediario"
          checked={Boolean(form.watch('termsAccepted'))}
          disabled={disabled}
          onChange={(event) =>
            form.setValue('termsAccepted', event.target.checked, {
              shouldValidate: true,
            })
          }
        />
        {form.formState.errors.termsAccepted ? (
          <div className="text-danger small mb-3">{form.formState.errors.termsAccepted.message}</div>
        ) : null}
        <Button type="submit" className="ca-btn-cta" disabled={disabled || saving}>
          {saving ? 'Guardando…' : 'Continuar'}
        </Button>
      </Form>
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
      weeklySlots: onboarding.weeklySlots.length
        ? onboarding.weeklySlots
        : [{ dayOfWeek: 'MONDAY', startTime: '09:00', endTime: '13:00' }],
    },
  });

  const slots = form.watch('weeklySlots');

  const addSlot = () => {
    const next: AgentScheduleSlot[] = [
      ...(slots ?? []),
      { dayOfWeek: 'TUESDAY', startTime: '14:00', endTime: '18:00' },
    ];
    form.setValue('weeklySlots', next, { shouldValidate: true });
  };

  const removeSlot = (index: number) => {
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
      <Form onSubmit={form.handleSubmit(onNext)} className="ca-form-grid">
        <Form.Group controlId="timezone" className="ca-form-grid__full">
          <Form.Label>Zona horaria</Form.Label>
          <Form.Control {...form.register('timezone')} disabled={disabled} />
        </Form.Group>

        <div className="ca-form-grid__full">
          {(slots ?? []).map((slot, index) => (
            <div key={`${slot.dayOfWeek}-${index}`} className="ca-slot-row">
              <Form.Select
                value={slot.dayOfWeek}
                disabled={disabled}
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
                disabled={disabled}
                onChange={(event) => {
                  const next = [...(slots ?? [])];
                  next[index] = { ...next[index]!, startTime: event.target.value };
                  form.setValue('weeklySlots', next, { shouldValidate: true });
                }}
              />
              <Form.Control
                type="time"
                value={slot.endTime}
                disabled={disabled}
                onChange={(event) => {
                  const next = [...(slots ?? [])];
                  next[index] = { ...next[index]!, endTime: event.target.value };
                  form.setValue('weeklySlots', next, { shouldValidate: true });
                }}
              />
              <Button
                type="button"
                variant="outline-danger"
                disabled={disabled || (slots?.length ?? 0) <= 1}
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
            disabled={disabled}
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
  const form = useZodForm(areaStepSchema, {
    defaultValues: {
      workAreaLabel: onboarding.workAreaLabel ?? '',
      workAreaCity: onboarding.workAreaCity ?? '',
      workAreaCountry: onboarding.workAreaCountry ?? 'AR',
      coverageRadiusKm: onboarding.coverageRadiusKm ?? 10,
    },
  });

  return (
    <section>
      <h3 className="ca-section-title">Área de trabajo y cobertura</h3>
      <p className="ca-section-lead">Zona donde podés mediar encuentros presenciales.</p>
      <Form onSubmit={form.handleSubmit(onNext)} className="ca-form-grid">
        <Form.Group controlId="workAreaLabel" className="ca-form-grid__full">
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
        <Form.Group controlId="workAreaCity">
          <Form.Label>Ciudad</Form.Label>
          <Form.Control
            {...form.register('workAreaCity')}
            disabled={disabled}
            isInvalid={Boolean(form.formState.errors.workAreaCity)}
          />
          <Form.Control.Feedback type="invalid">
            {form.formState.errors.workAreaCity?.message}
          </Form.Control.Feedback>
        </Form.Group>
        <Form.Group controlId="workAreaCountry">
          <Form.Label>País</Form.Label>
          <Form.Control
            {...form.register('workAreaCountry')}
            disabled={disabled}
            isInvalid={Boolean(form.formState.errors.workAreaCountry)}
          />
          <Form.Control.Feedback type="invalid">
            {form.formState.errors.workAreaCountry?.message}
          </Form.Control.Feedback>
        </Form.Group>
        <Form.Group controlId="coverageRadiusKm" className="ca-form-grid__full">
          <Form.Label>Radio de cobertura (km)</Form.Label>
          <Form.Range
            min={1}
            max={100}
            disabled={disabled}
            value={form.watch('coverageRadiusKm')}
            onChange={(event) =>
              form.setValue('coverageRadiusKm', Number(event.target.value), {
                shouldValidate: true,
              })
            }
          />
          <div className="ca-range-value">{form.watch('coverageRadiusKm')} km</div>
        </Form.Group>
        <div className="ca-form-actions ca-form-grid__full">
          <Button type="button" variant="outline-secondary" onClick={onBack}>
            Atrás
          </Button>
          <Button type="submit" className="ca-btn-primary" disabled={disabled || saving}>
            {saving ? 'Guardando…' : 'Continuar'}
          </Button>
        </div>
      </Form>
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
  onNext: (values: RateStepValues) => Promise<void>;
}) {
  const form = useZodForm(rateStepSchema, {
    defaultValues: {
      hourlyRate: onboarding.hourlyRateCents != null ? onboarding.hourlyRateCents / 100 : 25,
      currency: onboarding.currency || 'UYU',
    },
  });

  return (
    <section>
      <h3 className="ca-section-title">Tarifa</h3>
      <p className="ca-section-lead">Valor horario transparente para tus asignaciones.</p>
      <Form onSubmit={form.handleSubmit(onNext)} className="ca-form-grid">
        <Form.Group controlId="hourlyRate">
          <Form.Label>Tarifa por hora</Form.Label>
          <Form.Control
            type="number"
            step="0.01"
            min={1}
            disabled={disabled}
            {...form.register('hourlyRate')}
            isInvalid={Boolean(form.formState.errors.hourlyRate)}
          />
          <Form.Control.Feedback type="invalid">
            {form.formState.errors.hourlyRate?.message}
          </Form.Control.Feedback>
        </Form.Group>
        <Form.Group controlId="currency">
          <Form.Label>Moneda</Form.Label>
          <Form.Control
            {...form.register('currency')}
            disabled={disabled}
            isInvalid={Boolean(form.formState.errors.currency)}
          />
          <Form.Control.Feedback type="invalid">
            {form.formState.errors.currency?.message}
          </Form.Control.Feedback>
        </Form.Group>
        <div className="ca-form-actions ca-form-grid__full">
          <Button type="button" variant="outline-secondary" onClick={onBack}>
            Atrás
          </Button>
          <Button type="submit" className="ca-btn-primary" disabled={disabled || saving}>
            {saving ? 'Guardando…' : 'Continuar'}
          </Button>
        </div>
      </Form>
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
  const slotsLabel = useMemo(
    () =>
      onboarding.weeklySlots
        .map(
          (slot) =>
            `${DAY_LABELS[slot.dayOfWeek] ?? slot.dayOfWeek} ${slot.startTime}–${slot.endTime}`,
        )
        .join(' · '),
    [onboarding.weeklySlots],
  );

  return (
    <section>
      <h3 className="ca-section-title">Vista previa</h3>
      <p className="ca-section-lead">Revisá todo antes de confirmar tu alta como agente.</p>

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
            <dd>{onboarding.coverageRadiusKm ?? '—'} km</dd>
          </div>
          <div>
            <dt>Tarifa</dt>
            <dd>
              {onboarding.hourlyRateCents != null
                ? `${formatRate(onboarding.hourlyRateCents, onboarding.currency)} / h`
                : '—'}
            </dd>
          </div>
        </dl>
      </div>

      <div className="ca-form-actions mt-3">
        {!onboarding.isAgent ? (
          <Button type="button" variant="outline-secondary" onClick={onBack}>
            Atrás
          </Button>
        ) : null}
        <Button
          type="button"
          className="ca-btn-cta"
          disabled={onboarding.isAgent || submitting}
          onClick={() => void onSubmit()}
        >
          {onboarding.isAgent
            ? 'Agente activo'
            : submitting
              ? 'Confirmando…'
              : 'Confirmar y convertirme en agente'}
        </Button>
      </div>
    </section>
  );
}
