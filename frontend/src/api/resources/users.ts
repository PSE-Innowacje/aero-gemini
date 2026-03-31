import type { User } from '@/types';
import { toUiUser } from '@/api/mappers';
import { request } from '@/api/http';
import type { BackendUser } from '@/api/types';

export const fetchUsers = async (): Promise<User[]> => {
  const users = await request<BackendUser[]>('/users');
  return users.map(toUiUser);
};
