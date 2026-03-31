import type { Role } from '@/types';
import { request } from '@/api/http';

type LoginResponse = {
  access_token: string;
  token_type: string;
  role: Role;
  first_name?: string;
};

export const loginRequest = (email: string, password: string) =>
  request<LoginResponse>('/auth/login', 'POST', { email, password });
