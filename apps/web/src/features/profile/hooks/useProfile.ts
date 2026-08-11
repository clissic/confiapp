import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/ui/AuthProvider';

import { fetchMyProfile, updateMyProfile } from '../api/profile.api';
import type { ProfileUpdatePayload, UserProfile } from '../model/types';

export const profileQueryKey = (userId?: string | null) =>
  ['profile', 'me', userId ?? 'anonymous'] as const;

type ProfileQueryData = {
  profile: UserProfile;
  source: 'api' | 'demo';
};

export function useProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: profileQueryKey(user?.id),
    queryFn: fetchMyProfile,
    enabled: Boolean(user?.id),
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const { user, patchUser } = useAuth();

  return useMutation({
    mutationFn: async (payload: ProfileUpdatePayload) => {
      const cached = queryClient.getQueryData<ProfileQueryData>(profileQueryKey(user?.id));
      return updateMyProfile(payload, cached?.profile);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(profileQueryKey(user?.id), data);
      patchUser({
        fullName: data.profile.fullName,
        avatar: data.profile.avatar,
        identityVerified:
          Boolean(data.profile.identityVerified) || data.profile.kyc?.status === 'VERIFIED',
      });
    },
  });
}
