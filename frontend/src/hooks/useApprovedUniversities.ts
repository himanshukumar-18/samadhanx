import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';

export interface ApprovedUniversity {
  id: string;
  name: string;
  city: string;
  state: string;
}

const fetchApprovedUniversities = async (): Promise<ApprovedUniversity[]> => {
  const res = await apiClient.get('/public/universities');
  return res.data?.data || [];
};

export const useApprovedUniversities = (enabled = true) => {
  return useQuery({
    queryKey: ['universities', 'approved'],
    queryFn: fetchApprovedUniversities,
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes generous stale time
  });
};
