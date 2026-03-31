import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Role } from '@/types';
import { loginRequest } from '@/api/api';
import { setApiToken } from '@/api/token';

interface AuthState {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: () => boolean;
  hasRole: (roles: Role[]) => boolean;
}

const parseJwtPayload = (token: string): Record<string, unknown> => {
  const payload = token.split('.')[1];
  if (!payload) return {};
  const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
  try {
    return JSON.parse(atob(base64));
  } catch {
    return {};
  }
};

const isTokenStructurallyValid = (token: string | null | undefined): token is string => {
  if (!token) return false;
  return token.split('.').length === 3;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      login: async (email: string, password: string) => {
        const result = await loginRequest(email, password);
        const token = result.access_token;
        if (!isTokenStructurallyValid(token)) {
          throw new Error('Invalid access token format');
        }
        const claims = parseJwtPayload(token);
        const user: User = {
          id: String(claims.sub ?? ''),
          email,
          name: email,
          role: result.role as Role,
        };
        setApiToken(token);
        set({ user, token });
      },
      logout: () => {
        setApiToken(null);
        set({ user: null, token: null });
      },
      isAuthenticated: () => isTokenStructurallyValid(get().token),
      hasRole: (roles: Role[]) => {
        const user = get().user;
        return !!user && roles.includes(user.role);
      },
    }),
    {
      name: 'auth-storage',
      onRehydrateStorage: () => (state) => {
        if (!isTokenStructurallyValid(state?.token)) {
          setApiToken(null);
          if (state) {
            state.token = null;
            state.user = null;
          }
          return;
        }
        setApiToken(state.token);
      },
    }
  )
);
