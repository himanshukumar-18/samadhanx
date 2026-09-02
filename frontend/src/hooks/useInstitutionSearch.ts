import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';

export interface InstitutionMasterItem {
  id: string;
  name: string;
  aishe_code: string | null;
  city: string;
  state: string;
  category: string | null;
  verification_status: string;
}

interface InstitutionSearchResponse {
  data: InstitutionMasterItem[];
  total: number;
  limit: number;
  offset: number;
}

const fetchInstitutions = async (searchTerm: string): Promise<InstitutionSearchResponse> => {
  const params: Record<string, string | number> = { limit: 20 };
  if (searchTerm.trim().length >= 2) {
    params.q = searchTerm.trim();
  }
  const res = await apiClient.get('/public/institutions', { params });
  return res.data;
};

export const useInstitutionSearch = (searchTerm: string, enabled = true) => {
  const [debouncedTerm, setDebouncedTerm] = useState(searchTerm);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedTerm(searchTerm);
    }, 300); // 300ms debounce rate limit protection

    return () => clearTimeout(handler);
  }, [searchTerm]);

  return useQuery({
    queryKey: ['institutions', 'search', debouncedTerm],
    queryFn: () => fetchInstitutions(debouncedTerm),
    enabled: enabled,
    staleTime: 60 * 1000,
  });
};
