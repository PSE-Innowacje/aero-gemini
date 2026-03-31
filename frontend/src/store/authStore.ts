import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Role } from '@/types';

interface AuthState {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: () => boolean;
  hasRole: (roles: Role[]) => boolean;
}

// Mock users for demo
const mockUsers: Record<string, { password: string; user: User }> = {
  'admin@heli.app': {
    password: 'admin123',
    user: { id: '1', email: 'admin@heli.app', name: 'Jan Kowalski', role: 'ADMIN' },
  },
  'planner@heli.app': {
    password: 'planner123',
    user: { id: '2', email: 'planner@heli.app', name: 'Anna Nowak', role: 'PLANNER' },
  },
  'supervisor@heli.app': {
    password: 'super123',
    user: { id: '3', email: 'supervisor@heli.app', name: 'Piotr Wiśniewski', role: 'SUPERVISOR' },
  },
  'pilot@heli.app': {
    password: 'pilot123',
    user: { id: '4', email: 'pilot@heli.app', name: 'Marek Zieliński', role: 'PILOT' },
  },
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      login: async (email: string, password: string) => {
        const entry = mockUsers[email];
        if (!entry || entry.password !== password) {
          throw new Error('Invalid credentials');
        }
        const token = btoa(JSON.stringify(entry.user));
        set({ user: entry.user, token });
      },
      logout: () => set({ user: null, token: null }),
      isAuthenticated: () => !!get().token,
      hasRole: (roles: Role[]) => {
        const user = get().user;
        return !!user && roles.includes(user.role);
      },
    }),
    { name: 'auth-storage' }
  )
);
