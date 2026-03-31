import type { Role } from '@/types';

export const USER_ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Administrator',
  PLANNER: 'Osoba planująca',
  SUPERVISOR: 'Osoba nadzorująca',
  PILOT: 'Pilot',
};

export const getUserRoleLabel = (role: Role): string => USER_ROLE_LABELS[role] ?? role;
