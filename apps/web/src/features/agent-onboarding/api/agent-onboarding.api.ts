import { apiClient } from '@/shared/api/client';
import { formatMoney } from '@/shared/lib/money';

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
4. Tu tarifa se comunica con transparencia antes de aceptar una asignación.
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
    workAreaCountry: 'UY',
    currency: 'UYU',
    draftStep: 1,
    isAgent: false,
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
    return { ...createDemoOnboarding(), ...JSON.parse(raw) } as AgentOnboarding;
  } catch {
    return createDemoOnboarding();
  }
}

function saveDemo(data: AgentOnboarding): AgentOnboarding {
  localStorage.setItem(DEMO_KEY, JSON.stringify(data));
  return data;
}

function applyDraft(current: AgentOnboarding, payload: AgentOnboardingDraftPayload): AgentOnboarding {
  const next: AgentOnboarding = {
    ...current,
    ...payload,
    weeklySlots: payload.weeklySlots ?? current.weeklySlots,
    termsAccepted: payload.termsAccepted ?? current.termsAccepted,
    status: current.status === 'ACTIVE' ? 'ACTIVE' : 'DRAFT',
    draftStep: payload.draftStep ?? current.draftStep,
    preview: {
      ...current.preview,
      summary: buildSummary({ ...current, ...payload }),
    },
  };
  if (payload.termsAccepted) {
    next.termsAcceptedAt = new Date().toISOString();
  }
  return saveDemo(next);
}

function buildSummary(data: Partial<AgentOnboarding>): string {
  const slots = data.weeklySlots?.length ?? 0;
  const rate =
    data.hourlyRateCents != null
      ? `${(data.hourlyRateCents / 100).toFixed(2)} ${data.currency ?? 'UYU'}/h`
      : 'Tarifa pendiente';
  return `${data.workAreaLabel ?? 'Sin área'} · ${data.coverageRadiusKm ?? '?'} km · ${slots} franjas · ${rate}`;
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
    return { data: saveDemo(next), source: 'demo' };
  }
}

export function formatRate(cents: number, currency: string): string {
  return formatMoney(cents, currency);
}
