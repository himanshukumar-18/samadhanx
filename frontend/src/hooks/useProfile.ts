import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { profileApi, UserProfileDetail } from '../api/profile';
import toast from 'react-hot-toast';

export const useProfile = () => {
  return useQuery({
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
