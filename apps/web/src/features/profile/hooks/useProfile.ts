import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/ui/AuthProvider';

import { fetchMyProfile, updateMyProfile } from '../api/profile.api';
import type { ProfileUpdatePayload, UserProfile } from '../model/types';

export const profileQueryKey = ['profile', 'me'] as const;

type ProfileQueryData = {
  profile: UserProfile;
  source: 'api' | 'demo';
};

export function useProfile() {
  return useQuery({
    queryKey: profileQueryKey,
    queryFn: fetchMyProfile,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const { patchUser } = useAuth();

  return useMutation({
    mutationFn: async (payload: ProfileUpdatePayload) => {
      const cached = queryClient.getQueryData<ProfileQueryData>(profileQueryKey);
      return updateMyProfile(payload, cached?.profile);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(profileQueryKey, data);
      patchUser({
        fullName: data.profile.fullName,
        avatar: data.profile.avatar,
        identityVerified:
          Boolean(data.profile.identityVerified) || data.profile.kyc?.status === 'VERIFIED',
      });
    },
  });
}
