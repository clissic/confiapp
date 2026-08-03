import { apiClient } from '@/shared/api/client';

import { applyDemoUpdate, loadDemoProfile } from './demo-profile';
import type { ProfileUpdatePayload, UserProfile } from '../model/types';

function hasAccessToken(): boolean {
  return Boolean(localStorage.getItem('accessToken'));
}

export async function fetchMyProfile(): Promise<{ profile: UserProfile; source: 'api' | 'demo' }> {
  if (!hasAccessToken()) {
    return { profile: loadDemoProfile(), source: 'demo' };
  }

  try {
    const { data } = await apiClient.get<UserProfile>('/users/me');
    return { profile: data, source: 'api' };
  } catch {
    return { profile: loadDemoProfile(), source: 'demo' };
  }
}

export async function updateMyProfile(
  payload: ProfileUpdatePayload,
  current?: UserProfile,
): Promise<{ profile: UserProfile; source: 'api' | 'demo' }> {
  if (!hasAccessToken()) {
    const base = current ?? loadDemoProfile();
    return { profile: applyDemoUpdate(base, payload), source: 'demo' };
  }

  try {
    const { data } = await apiClient.patch<UserProfile>('/users/me', payload);
    return { profile: data, source: 'api' };
  } catch {
    const base = current ?? loadDemoProfile();
    return { profile: applyDemoUpdate(base, payload), source: 'demo' };
  }
}

export { formatMoney } from '@/shared/lib/money';
