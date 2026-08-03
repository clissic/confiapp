import { apiClient } from '@/shared/api/client';

import type { AgentOffer, AgentSearchHit } from '../model/types';
import type { OpenJob, OpenJobsFilters } from '../model/open-jobs.types';

const DEMO_OFFERS_KEY = 'confiapp.agent.offers.demo';

function hasAccessToken(): boolean {
  return Boolean(localStorage.getItem('accessToken'));
}

function loadDemoOffers(): AgentOffer[] {
  try {
    const raw = localStorage.getItem(DEMO_OFFERS_KEY);
    return raw ? (JSON.parse(raw) as AgentOffer[]) : [];
  } catch {
    return [];
  }
}

function saveDemoOffers(list: AgentOffer[]): AgentOffer[] {
  localStorage.setItem(DEMO_OFFERS_KEY, JSON.stringify(list));
  return list;
}

export async function searchAgents(params: {
  lng: number;
  lat: number;
  radiusKm: number;
  at?: string;
  limit?: number;
}): Promise<{ items: AgentSearchHit[]; source: 'api' | 'demo' }> {
  if (!hasAccessToken()) {
    return {
      source: 'demo',
      items: [
        {
          id: 'demo-agent-1',
          fullName: 'Carla Agente',
          displayName: 'Carla',
          distanceKm: 1.2,
          ratingAverage: 4.8,
          ratingCount: 24,
          activeJobs: 1,
          maxActiveTransactions: 5,
          coverageRadiusKm: 15,
          isAcceptingAssignments: true,
          hourlyRateCents: 850000,
          currency: 'UYU',
          timezone: 'America/Argentina/Buenos_Aires',
          score: 0.91,
          locationLabel: 'Palermo',
        },
        {
          id: 'demo-agent-2',
          fullName: 'Diego Intermediario',
          distanceKm: 3.4,
          ratingAverage: 4.5,
          ratingCount: 11,
          activeJobs: 0,
          maxActiveTransactions: 3,
          coverageRadiusKm: 20,
          isAcceptingAssignments: true,
          hourlyRateCents: 700000,
          currency: 'UYU',
          timezone: 'America/Argentina/Buenos_Aires',
          score: 0.84,
          locationLabel: 'Belgrano',
        },
      ],
    };
  }
  try {
    const { data } = await apiClient.get<{ items: AgentSearchHit[] }>('/agents/search', {
      params,
    });
    return { items: data.items, source: 'api' };
  } catch {
    return {
      source: 'demo',
      items: [
        {
          id: 'demo-agent-fallback',
          fullName: 'Agente demo (fallback)',
          distanceKm: 2.1,
          ratingAverage: 4.6,
          ratingCount: 8,
          activeJobs: 0,
          maxActiveTransactions: 5,
          coverageRadiusKm: 12,
          isAcceptingAssignments: true,
          timezone: 'America/Argentina/Buenos_Aires',
          score: 0.8,
          locationLabel: 'CABA',
        },
      ],
    };
  }
}

export async function offerAssignment(payload: {
  transactionCode: string;
  lng: number;
  lat: number;
  radiusKm: number;
  expiresInSeconds?: number;
}): Promise<{ source: 'api' | 'demo'; data: unknown }> {
  if (!hasAccessToken()) {
    const expiresAt = new Date(Date.now() + (payload.expiresInSeconds ?? 120) * 1000).toISOString();
    const offer: AgentOffer = {
      id: `demo-offer-${Date.now()}`,
      type: 'AGENT_ASSIGNMENT',
      title: `Nueva asignación · ${payload.transactionCode}`,
      body: 'Oferta demo para mediación. Aceptá o rechazá antes de que expire.',
      actionStatus: 'PENDING',
      expiresAt,
      data: { transactionCode: payload.transactionCode },
      createdAt: new Date().toISOString(),
      isExpired: false,
    };
    saveDemoOffers([offer, ...loadDemoOffers()]);
    return { source: 'demo', data: { notification: offer } };
  }
  const { data } = await apiClient.post('/agents/assignments/offer', payload);
  return { source: 'api', data };
}

export async function listAgentOffers(): Promise<{
  items: AgentOffer[];
  source: 'api' | 'demo';
}> {
  if (!hasAccessToken()) {
    return { items: loadDemoOffers(), source: 'demo' };
  }
  try {
    const { data } = await apiClient.get<{ items: AgentOffer[] }>('/agents/offers');
    return { items: data.items, source: 'api' };
  } catch {
    return { items: loadDemoOffers(), source: 'demo' };
  }
}

export async function acceptAgentOffer(id: string): Promise<AgentOffer> {
  if (!hasAccessToken()) {
    const list = loadDemoOffers();
    const updated = list.map((item) =>
      item.id === id
        ? {
            ...item,
            actionStatus: 'ACCEPTED' as const,
            respondedAt: new Date().toISOString(),
            isExpired: false,
          }
        : item,
    );
    saveDemoOffers(updated);
    const found = updated.find((item) => item.id === id);
    if (!found) throw new Error('Oferta no encontrada');
    return found;
  }
  const { data } = await apiClient.post<AgentOffer>(`/agents/offers/${id}/accept`);
  return data;
}

export async function rejectAgentOffer(id: string): Promise<{
  notification: AgentOffer;
  reassigned?: AgentOffer;
}> {
  if (!hasAccessToken()) {
    const list = loadDemoOffers();
    const updated = list.map((item) =>
      item.id === id
        ? {
            ...item,
            actionStatus: 'REJECTED' as const,
            respondedAt: new Date().toISOString(),
          }
        : item,
    );
    saveDemoOffers(updated);
    const found = updated.find((item) => item.id === id);
    if (!found) throw new Error('Oferta no encontrada');
    return { notification: found };
  }
  const { data } = await apiClient.post<{
    notification: AgentOffer;
    reassigned?: AgentOffer;
  }>(`/agents/offers/${id}/reject`);
  return data;
}

export async function reassignAgent(code: string): Promise<unknown> {
  if (!hasAccessToken()) {
    return { message: 'Reasignación demo' };
  }
  const { data } = await apiClient.post(`/agents/assignments/${code}/reassign`);
  return data;
}

function demoOpenJobs(filters: OpenJobsFilters): OpenJob[] {
  const base: OpenJob[] = [
    {
      id: 'demo-job-1',
      code: 'CONF-A1B2C3D4',
      title: 'Entrega notebook en Palermo',
      description: 'Verificación en persona y acta fotográfica.',
      status: 'ACCEPTED',
      amountCents: 45000000,
      currency: 'UYU',
      distanceKm: 1.8,
      meeting: { lng: -58.4305, lat: -34.5889, label: 'Palermo Soho' },
      buyer: { id: 'b1', name: 'Martín R.', ratingAverage: 4.7, ratingCount: 18 },
      seller: { id: 's1', name: 'Lucía V.', ratingAverage: 4.9, ratingCount: 32 },
      initiatedBy: 'BUYER',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'demo-job-2',
      code: 'CONF-E5F6G7H8',
      title: 'Retiro de iPhone en Belgrano',
      status: 'WAITING_PARTICIPANT',
      amountCents: 28000000,
      currency: 'UYU',
      distanceKm: 3.2,
      meeting: { lng: -58.458, lat: -34.5627, label: 'Belgrano C' },
      buyer: { id: 'b2', name: 'Ana P.', ratingAverage: 4.2, ratingCount: 7 },
      seller: { id: 's2', name: 'Diego M.', ratingAverage: 4.5, ratingCount: 14 },
      initiatedBy: 'SELLER',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'demo-job-3',
      code: 'CONF-I9J0K1L2',
      title: 'Inspección de bicicleta en Caballito',
      status: 'ACCEPTED',
      amountCents: 12000000,
      currency: 'UYU',
      distanceKm: 5.1,
      meeting: { lng: -58.445, lat: -34.62, label: 'Caballito' },
      buyer: { id: 'b3', name: 'Sofía L.', ratingAverage: 3.9, ratingCount: 4 },
      seller: { id: 's3', name: 'Nico T.', ratingAverage: 4.1, ratingCount: 9 },
      initiatedBy: 'BUYER',
      createdAt: new Date().toISOString(),
    },
  ];

  return base.filter((job) => {
    if (filters.maxDistanceKm != null && job.distanceKm > filters.maxDistanceKm) {
      return false;
    }
    if (filters.minPay != null && job.amountCents / 100 < filters.minPay) return false;
    if (
      filters.minBuyerRating != null &&
      job.buyer.ratingAverage < filters.minBuyerRating
    ) {
      return false;
    }
    if (
      filters.minSellerRating != null &&
      job.seller.ratingAverage < filters.minSellerRating
    ) {
      return false;
    }
    return job.distanceKm <= filters.radiusKm;
  });
}

export async function listOpenJobs(
  filters: OpenJobsFilters,
): Promise<{ items: OpenJob[]; source: 'api' | 'demo' }> {
  if (!hasAccessToken()) {
    return { items: demoOpenJobs(filters), source: 'demo' };
  }
  try {
    const { data } = await apiClient.get<{ items: OpenJob[] }>('/agents/jobs/open', {
      params: filters,
    });
    return { items: data.items, source: 'api' };
  } catch {
    return { items: demoOpenJobs(filters), source: 'demo' };
  }
}

export async function acceptOpenJob(code: string): Promise<OpenJob> {
  if (!hasAccessToken()) {
    const found = demoOpenJobs({
      lng: -58.3816,
      lat: -34.6037,
      radiusKm: 50,
    }).find((job) => job.code === code);
    if (!found) throw new Error('Trabajo no encontrado');
    return found;
  }
  const { data } = await apiClient.post<OpenJob>(`/agents/jobs/${code}/accept`);
  return data;
}
