import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

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

  return useMutation({
    mutationFn: async (payload: ProfileUpdatePayload) => {
      const cached = queryClient.getQueryData<ProfileQueryData>(profileQueryKey);
      return updateMyProfile(payload, cached?.profile);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(profileQueryKey, data);
    },
  });
}
