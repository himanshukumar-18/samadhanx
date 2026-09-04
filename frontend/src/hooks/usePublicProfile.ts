import { useQuery } from '@tanstack/react-query';
import { profileApi, PublicUserProfile } from '../api/profile';
import { mapApiProblem } from '../lib/problemMapper';

/**
 * Fetch the privacy-clean public profile for any user by UUID.
 *
 * Cache key: ['public-profile', userId]
 * Intentionally separate from ['citizen', 'profile'] (own profile) and
 * ['profile', 'me'] (shared own profile) to prevent cache conflicts.
 *
 * staleTime: 3 minutes — public profiles rarely change mid-session.
 */
export const usePublicProfile = (userId: string | null | undefined) => {
  return useQuery<PublicUserProfile>({
    queryKey: ['public-profile', userId],
    queryFn: () => profileApi.getPublicUserProfile(userId!),
    enabled: Boolean(userId),
    staleTime: 1000 * 60 * 3,
    retry: 1,
  });
};

/**
 * Fetch a user's publicly visible problems (paginated, server-filtered).
 * Backend excludes rejected problems server-side.
 */
export const useUserPublicProblems = (
  userId: string | null | undefined,
  offset = 0,
  limit = 10,
) => {
  return useQuery<any[]>({
    queryKey: ['public-profile-problems', userId, offset, limit],
    queryFn: async () => {
      const raw = await profileApi.getUserPublicProblems(userId!, offset, limit);
      return Array.isArray(raw) ? raw.map(mapApiProblem) : [];
    },
    enabled: Boolean(userId),
    staleTime: 1000 * 60 * 2,
  });
};
