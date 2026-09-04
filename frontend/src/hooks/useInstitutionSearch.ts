import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { institutionsApi, InstitutionMasterItem } from '../api/institutions';

export type { InstitutionMasterItem };

interface InstitutionSearchResponse {
  success: boolean;
  data: InstitutionMasterItem[];
  message?: string;
}

export const useInstitutionSearch = (searchTerm: string, enabled = true, stateFilter?: string) => {
  const [debouncedTerm, setDebouncedTerm] = useState(searchTerm);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedTerm(searchTerm);
    }, 300); // 300ms debounce protection

    return () => clearTimeout(handler);
  }, [searchTerm]);

  return useQuery<InstitutionSearchResponse>({
    queryKey: ['institutions', 'search', debouncedTerm, stateFilter],
    queryFn: () =>
      institutionsApi.searchPublicInstitutions({
        q: debouncedTerm.trim().length >= 2 ? debouncedTerm.trim() : undefined,
        state: stateFilter?.trim() || undefined,
        limit: 20,
      }),
    enabled: enabled,
    staleTime: 60 * 1000,
  });
};
