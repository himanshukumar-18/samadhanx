import { create } from 'zustand';
import { authApi } from '../api/auth';

export interface UserData {
  id: string;
  email: string;
  role: 'citizen' | 'student' | 'faculty' | 'industry' | 'university' | 'admin';
  is_verified: boolean;
  is_approved: boolean;
  is_active: boolean;
  full_name?: string | null;
  organization_name?: string | null;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
}

interface AuthState {
  user: UserData | null;
  accessToken: string | null;
  refreshToken: string | null;
  role: string | null;
  isAuthenticated: boolean;
  isVerified: boolean;
  isApproved: boolean;
  isLoading: boolean;
  
  // Actions
  setAuth: (data: { user: UserData; tokens: AuthTokens }) => void;
  setTokens: (tokens: AuthTokens) => void;
  setUser: (user: UserData) => void;
  restoreSession: () => Promise<void>;
  logout: () => void;
}

const getStoredAuth = () => {
  try {
    const tokensStr = localStorage.getItem('samadhanx_tokens');
    const userStr = localStorage.getItem('samadhanx_user');
    const tokens = tokensStr ? JSON.parse(tokensStr) : null;
    const user = userStr ? JSON.parse(userStr) : null;
    
    if (tokens?.access_token && user) {
      return {
        user,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        role: user.role,
        isAuthenticated: true,
        isVerified: user.is_verified,
        isApproved: user.is_approved,
      };
    }
  } catch (e) {
    console.error('Error loading stored auth state:', e);
  }
  return {
    user: null,
    accessToken: null,
    refreshToken: null,
    role: null,
    isAuthenticated: false,
    isVerified: false,
    isApproved: false,
  };
};

const initialAuth = getStoredAuth();

export const useAuthStore = create<AuthState>((set, get) => ({
  user: initialAuth.user,
  accessToken: initialAuth.accessToken,
  refreshToken: initialAuth.refreshToken,
  role: initialAuth.role,
  isAuthenticated: initialAuth.isAuthenticated,
  isVerified: initialAuth.isVerified,
  isApproved: initialAuth.isApproved,
  isLoading: !!initialAuth.accessToken,

  setAuth: ({ user, tokens }) => {
    localStorage.setItem('samadhanx_tokens', JSON.stringify(tokens));
    localStorage.setItem('samadhanx_user', JSON.stringify(user));
    set({
      user,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      role: user.role,
      isAuthenticated: true,
      isVerified: user.is_verified,
      isApproved: user.is_approved,
      isLoading: false,
    });
  },

  setTokens: (tokens) => {
    localStorage.setItem('samadhanx_tokens', JSON.stringify(tokens));
    set({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      isAuthenticated: true,
    });
  },

  setUser: (user) => {
    localStorage.setItem('samadhanx_user', JSON.stringify(user));
    set({
      user,
      role: user.role,
      isVerified: user.is_verified,
      isApproved: user.is_approved,
    });
  },

  restoreSession: async () => {
    const token = get().accessToken;
    if (!token) {
      set({ isLoading: false });
      return;
    }

    try {
      set({ isLoading: true });
      const user = await authApi.getMe();
      if (user) {
        get().setUser(user);
      }
    } catch (err) {
      console.warn('Session restoration failed:', err);
      get().logout();
    } finally {
      set({ isLoading: false });
    }
  },

  logout: () => {
    localStorage.removeItem('samadhanx_tokens');
    localStorage.removeItem('samadhanx_user');
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      role: null,
      isAuthenticated: false,
      isVerified: false,
      isApproved: false,
      isLoading: false,
    });
  },
}));
