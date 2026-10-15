import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DuplicateCandidatePublic, duplicatesApi } from '../../../api/duplicates';

interface UseDuplicateCheckOptions {
  title: string;
  description: string;
  category?: string;
  district?: string;
  debounceMs?: number;
}

export function useDuplicateCheck({
  title,
  description,
  category,
  district,
  debounceMs = 800,
}: UseDuplicateCheckOptions) {
  const [debouncedParams, setDebouncedParams] = useState<{
    title: string;
    description: string;
    category?: string;
    district?: string;
  } | null>(null);

  const [dismissed, setDismissed] = useState(false);

  // Debounce input changes: requires title >= 8 chars and description >= 30 chars
  useEffect(() => {
    const trimmedTitle = title.trim();
    const trimmedDesc = description.trim();

    if (trimmedTitle.length < 8 || trimmedDesc.length < 30) {
      setDebouncedParams(null);
      setDismissed(false);
      return;
    }

    const handler = setTimeout(() => {
      setDebouncedParams({
        title: trimmedTitle,
        description: trimmedDesc,
        category: category?.trim() || undefined,
        district: district?.trim() || undefined,
      });
      setDismissed(false);
    }, debounceMs);

    return () => clearTimeout(handler);
  }, [title, description, category, district, debounceMs]);

  const query = useQuery({
    queryKey: ['duplicate-precheck', debouncedParams?.title, debouncedParams?.description, debouncedParams?.district],
    queryFn: async ({ signal }) => {
      if (!debouncedParams) return { candidates: [], degraded: false };
      try {
        return await duplicatesApi.precheck(debouncedParams, signal);
      } catch {
        // Fail-open: Never disrupt the user submission flow on duplicate-check error
        return { candidates: [], degraded: true };
      }
    },
    enabled: Boolean(debouncedParams && !dismissed),
    staleTime: 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const candidates: DuplicateCandidatePublic[] = dismissed || query.data?.degraded ? [] : query.data?.candidates || [];

  const dismissCandidates = () => {
    setDismissed(true);
  };

  return {
    candidates,
    isSearching: query.isFetching && Boolean(debouncedParams && !dismissed),
    degraded: query.data?.degraded || false,
    dismissed,
    dismissCandidates,
  };
}
