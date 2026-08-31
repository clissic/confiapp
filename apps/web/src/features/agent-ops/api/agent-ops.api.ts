import { amountCentsToUyu, minProductUyuForMinCommission } from '@confiapp/shared';

import { apiClient } from '@/shared/api/client';

import type { AgentSearchHit } from '../model/types';
import type { OpenJob, OpenJobsFilters } from '../model/open-jobs.types';

function hasAccessToken(): boolean {
  return Boolean(localStorage.getItem('accessToken'));
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
      pickup: {
        lng: -58.4305,
        lat: -34.5889,
        label: 'Palermo Soho · retiro vendedor',
        hasPoint: true,
      },
      delivery: {
        lng: -58.422,
        lat: -34.595,
        label: 'Plaza Serrano · entrega comprador',
        hasPoint: true,
      },
      routeKm: 1.1,
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
      pickup: {
        lng: -58.458,
        lat: -34.5627,
        label: 'Belgrano C',
        hasPoint: true,
      },
      delivery: {
        label: 'Coordinar entrega por chat',
        hasPoint: false,
      },
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
      pickup: {
        lng: -58.445,
        lat: -34.62,
        label: 'Parque Rivadavia',
        hasPoint: true,
      },
      delivery: {
        lng: -58.451,
        lat: -34.615,
        label: 'Av. Rivadavia 5200',
        hasPoint: true,
      },
      routeKm: 0.8,
      buyer: { id: 'b3', name: 'Sofía L.', ratingAverage: 3.9, ratingCount: 4 },
      seller: { id: 's3', name: 'Nico T.', ratingAverage: 4.1, ratingCount: 9 },
      initiatedBy: 'BUYER',
      createdAt: new Date().toISOString(),
    },
  ];

  return base.filter((job) => {
    if (job.distanceKm > filters.radiusKm) return false;
    if (filters.minCommissionUyu != null) {
      const productUyu = amountCentsToUyu(job.amountCents, job.currency);
      const minProduct = minProductUyuForMinCommission(filters.minCommissionUyu);
      if (productUyu < minProduct) return false;
    }
    if (
      filters.minBuyerRating != null &&
      job.buyer.ratingAverage < filters.minBuyerRating
    ) {
      return false;
    }
    if (
      filters.maxBuyerRating != null &&
      job.buyer.ratingAverage > filters.maxBuyerRating
    ) {
      return false;
    }
    if (
      filters.minSellerRating != null &&
      job.seller.ratingAverage < filters.minSellerRating
    ) {
      return false;
    }
    if (
      filters.maxSellerRating != null &&
      job.seller.ratingAverage > filters.maxSellerRating
    ) {
      return false;
    }
    return true;
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
    return {
      items: data.items.map((job) => ({
        ...job,
        pickup: job.pickup ?? { hasPoint: false },
        delivery: job.delivery ?? { hasPoint: false },
      })),
      source: 'api',
    };
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

export async function withdrawFromJob(
  code: string,
  reason?: string,
): Promise<{
  code: string;
  status: string;
  lookingForAgent: true;
  reopenedViaOffer: boolean;
}> {
  const { data } = await apiClient.post<{
    code: string;
    status: string;
    lookingForAgent: true;
    reopenedViaOffer: boolean;
  }>(`/agents/jobs/${encodeURIComponent(code)}/withdraw`, reason ? { reason } : {});
  return data;
}
