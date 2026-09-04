import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { profileApi, CitizenProfile, CitizenProfileUpdatePayload, UserProfileDetail } from '../api/profile';
import toast from 'react-hot-toast';

// ---------------------------------------------------------------------------
// Shared profile hook (non-citizen roles)
// ---------------------------------------------------------------------------

export const useProfile = () => {
  return useQuery<UserProfileDetail>({
    queryKey: ['profile', 'me'],
    queryFn: () => profileApi.getMyProfile(),
    staleTime: 1000 * 60 * 5,
  });
};

export const useUpdateProfile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<UserProfileDetail>) => profileApi.updateMyProfile(data),
    onSuccess: (updated) => {
      queryClient.setQueryData(['profile', 'me'], updated);
      queryClient.invalidateQueries({ queryKey: ['profile', 'me'] });
      queryClient.invalidateQueries({ queryKey: ['my-profile-detail'] });
      toast.success('Profile updated successfully');
    },
  });
};

// ---------------------------------------------------------------------------
// Citizen-specific profile hooks
// ---------------------------------------------------------------------------

export const useCitizenProfile = () => {
  return useQuery<CitizenProfile>({
    queryKey: ['citizen', 'profile'],
    queryFn: () => profileApi.getCitizenProfile(),
    staleTime: 1000 * 60 * 3,
    retry: 2,
  });
};

export const useUpdateCitizenProfile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CitizenProfileUpdatePayload) => profileApi.updateCitizenProfile(data),
    onSuccess: (updated) => {
      queryClient.setQueryData(['citizen', 'profile'], updated);
      queryClient.invalidateQueries({ queryKey: ['citizen', 'profile'] });
      toast.success('Profile saved successfully');
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.detail?.message ||
        err?.response?.data?.detail ||
        'Failed to save profile. Please check your inputs.';
      toast.error(typeof msg === 'string' ? msg : 'Failed to save profile.');
    },
  });
};
