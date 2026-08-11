import { ApiClientError, apiClient } from '@/shared/api/client';
import { formatDistance } from '@/shared/lib/distance';
import { getPreferencesSnapshot } from '@/shared/preferences';

import type {
  AgentOnboarding,
  AgentOnboardingDraftPayload,
  AgentOnboardingSubmitPayload,
} from '../model/types';

const DEMO_KEY = 'confiapp.agent.onboarding.demo';

const TERMS_TEXT = `Términos y condiciones del Agente Intermediario — ConfiApp

1. Actuás como intermediario imparcial entre comprador y vendedor.
2. Protegés la confidencialidad de las partes y la evidencia de la operación.
3. Declarás disponibilidad real según los horarios configurados.
4. Las tarifas de intermediación las define ConfiApp según el valor del producto; el Agente no las fija.
5. ConfiApp puede suspender el rol ante incumplimiento o disputas graves.
6. Aceptás que los fondos de escrow no son de tu propiedad.`;

function createDemoOnboarding(): AgentOnboarding {
  return {
    status: 'NONE',
    termsVersion: '1.0.0',
    termsText: TERMS_TEXT,
    termsAccepted: false,
    timezone: 'America/Montevideo',
    weeklySlots: [],
    unspecifiedSchedule: false,
    workAreaCountry: 'UY',
    currency: 'USD',
    ratesAccepted: false,
    draftStep: 1,
    isAgent: false,
    activeJobsCount: 0,
    activeJobs: [],
    preview: {
      fullName: 'Joaquín Creator',
      email: 'joaquin@confiapp.demo',
      summary: 'Completá el flujo para ver la vista previa',
    },
  };
}

function hasAccessToken(): boolean {
  return Boolean(localStorage.getItem('accessToken'));
}

function loadDemo(): AgentOnboarding {
  try {
    const raw = localStorage.getItem(DEMO_KEY);
    if (!raw) return createDemoOnboarding();
    const parsed = JSON.parse(raw) as Partial<AgentOnboarding>;
    return {
      ...createDemoOnboarding(),
      ...parsed,
      ratesAccepted: Boolean(parsed.ratesAccepted),
      termsAccepted: Boolean(parsed.termsAccepted),
      unspecifiedSchedule: Boolean(parsed.unspecifiedSchedule),
      isAgent: parsed.status === 'ACTIVE' || parsed.status === 'INACTIVE',
    };
  } catch {
    return createDemoOnboarding();
  }
}

function saveDemo(data: AgentOnboarding): AgentOnboarding {
  localStorage.setItem(DEMO_KEY, JSON.stringify(data));
  return data;
}

function applyDraft(current: AgentOnboarding, payload: AgentOnboardingDraftPayload): AgentOnboarding {
  const registered = current.status === 'ACTIVE' || current.status === 'INACTIVE';
  const unspecifiedSchedule = payload.unspecifiedSchedule ?? current.unspecifiedSchedule;
  const next: AgentOnboarding = {
    ...current,
    ...payload,
    unspecifiedSchedule: Boolean(unspecifiedSchedule),
    weeklySlots: unspecifiedSchedule
      ? []
      : (payload.weeklySlots ?? current.weeklySlots),
    termsAccepted: payload.termsAccepted ?? current.termsAccepted,
    ratesAccepted: payload.ratesAccepted ?? current.ratesAccepted,
    status: registered ? current.status : current.status === 'ACTIVE' ? 'ACTIVE' : 'DRAFT',
    draftStep: payload.draftStep ?? current.draftStep,
    isAgent: registered,
    preview: {
      ...current.preview,
      summary: buildSummary({
        ...current,
        ...payload,
        unspecifiedSchedule: Boolean(unspecifiedSchedule),
        weeklySlots: unspecifiedSchedule ? [] : (payload.weeklySlots ?? current.weeklySlots),
      }),
    },
  };
  if (payload.termsAccepted) {
    next.termsAcceptedAt = new Date().toISOString();
  }
  if (payload.ratesAccepted) {
    next.ratesAcceptedAt = new Date().toISOString();
  }
  return saveDemo(next);
}

function buildSummary(data: Partial<AgentOnboarding>): string {
  const slots = data.weeklySlots?.length ?? 0;
  const rate = data.ratesAccepted ? 'Tarifa de plataforma aceptada' : 'Tarifa pendiente';
  const unit = getPreferencesSnapshot().distanceUnit;
  const radius =
    data.coverageRadiusKm != null ? formatDistance(data.coverageRadiusKm, unit, 0) : '?';
  const franjaLabel = data.unspecifiedSchedule
    ? 'Disponible 24 h'
    : slots === 1
      ? '1 franja'
      : `${slots} franjas`;
  return `${data.workAreaLabel ?? 'Sin área'} · ${radius} · ${franjaLabel} · ${rate}`;
}

async function postOnboardingAction(
  path: string,
  current?: AgentOnboarding,
  demoTransform?: (base: AgentOnboarding) => AgentOnboarding,
): Promise<{ data: AgentOnboarding; source: 'api' | 'demo' }> {
  if (!hasAccessToken()) {
    const base = current ?? loadDemo();
    return { data: saveDemo(demoTransform ? demoTransform(base) : base), source: 'demo' };
  }
  try {
    const { data } = await apiClient.post<AgentOnboarding>(path);
    return { data, source: 'api' };
  } catch {
    const base = current ?? loadDemo();
    return { data: saveDemo(demoTransform ? demoTransform(base) : base), source: 'demo' };
  }
}

export async function fetchAgentOnboarding(): Promise<{
  data: AgentOnboarding;
  source: 'api' | 'demo';
}> {
  if (!hasAccessToken()) {
    return { data: loadDemo(), source: 'demo' };
  }
  try {
    const { data } = await apiClient.get<AgentOnboarding>('/agents/onboarding');
    return { data, source: 'api' };
  } catch {
    return { data: loadDemo(), source: 'demo' };
  }
}

export async function saveAgentOnboardingDraft(
  payload: AgentOnboardingDraftPayload,
  current?: AgentOnboarding,
): Promise<{ data: AgentOnboarding; source: 'api' | 'demo' }> {
  if (!hasAccessToken()) {
    return { data: applyDraft(current ?? loadDemo(), payload), source: 'demo' };
  }
  try {
    const { data } = await apiClient.put<AgentOnboarding>('/agents/onboarding', payload);
    return { data, source: 'api' };
  } catch {
    return { data: applyDraft(current ?? loadDemo(), payload), source: 'demo' };
  }
}

export async function submitAgentOnboarding(
  payload: AgentOnboardingSubmitPayload,
  current?: AgentOnboarding,
): Promise<{ data: AgentOnboarding; source: 'api' | 'demo' }> {
  if (!hasAccessToken()) {
    const base = current ?? loadDemo();
    const next = applyDraft(base, { ...payload, draftStep: 5 });
    next.status = 'ACTIVE';
    next.isAgent = true;
    next.submittedAt = new Date().toISOString();
    next.activatedAt = next.submittedAt;
    next.preview.summary = buildSummary(next);
    return { data: saveDemo(next), source: 'demo' };
  }
  try {
    const { data } = await apiClient.post<AgentOnboarding>('/agents/onboarding/submit', payload);
    return { data, source: 'api' };
  } catch {
    const base = current ?? loadDemo();
    const next = applyDraft(base, { ...payload, draftStep: 5 });
    next.status = 'ACTIVE';
    next.isAgent = true;
    next.submittedAt = new Date().toISOString();
    next.activatedAt = next.submittedAt;
    next.preview.summary = buildSummary(next);
    return { data: saveDemo(next), source: 'demo' };
  }
}

export async function suspendAgentActivity(
  current?: AgentOnboarding,
): Promise<{ data: AgentOnboarding; source: 'api' | 'demo' }> {
  return postOnboardingAction('/agents/onboarding/suspend', current, (base) => ({
    ...base,
    status: 'INACTIVE',
    isAgent: true,
    preview: { ...base.preview, summary: buildSummary({ ...base, status: 'INACTIVE' }) },
  }));
}

export async function resumeAgentActivity(
  current?: AgentOnboarding,
): Promise<{ data: AgentOnboarding; source: 'api' | 'demo' }> {
  return postOnboardingAction('/agents/onboarding/resume', current, (base) => ({
    ...base,
    status: 'ACTIVE',
    isAgent: true,
    preview: { ...base.preview, summary: buildSummary({ ...base, status: 'ACTIVE' }) },
  }));
}

export async function closeAgentAgency(
  current?: AgentOnboarding,
): Promise<{ data: AgentOnboarding; source: 'api' | 'demo' }> {
  if (!hasAccessToken()) {
    const base = current ?? loadDemo();
    const reset = createDemoOnboarding();
    return {
      data: saveDemo({
        ...reset,
        preview: {
          ...base.preview,
          summary: 'Completá el flujo para ver la vista previa',
        },
      }),
      source: 'demo',
    };
  }
  try {
    const { data } = await apiClient.post<AgentOnboarding>('/agents/onboarding/close');
    return { data, source: 'api' };
  } catch (err) {
    if (err instanceof ApiClientError && err.code === 'ACTIVE_JOBS') {
      throw err;
    }
    const base = current ?? loadDemo();
    const reset = createDemoOnboarding();
    return {
      data: saveDemo({
        ...reset,
        preview: {
          ...base.preview,
          summary: 'Completá el flujo para ver la vista previa',
        },
      }),
      source: 'demo',
    };
  }
}
