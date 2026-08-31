import { useAuthStore } from '../store/authStore';
export { type UserRole } from '../types/role';

export function useAuth() {
  return useAuthStore();
}
