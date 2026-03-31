import type { CrewMember } from '@/types';
import { toUiCrew } from '@/api/mappers';
import { request } from '@/api/http';
import type { BackendCrewMember } from '@/api/types';

type CreateCrewPayload = {
  first_name: string;
  last_name: string;
  email: string;
  weight: number;
  role: CrewMember['role'];
  pilot_license_number: string | null;
  license_valid_until: string | null;
  training_valid_until: string;
};

export const fetchCrew = async (): Promise<CrewMember[]> => {
  const crew = await request<BackendCrewMember[]>('/crew-members');
  return crew.map(toUiCrew);
};

export const createCrewMember = async (data: Omit<CrewMember, 'id'>): Promise<CrewMember> => {
  const [firstName, ...rest] = data.name.trim().split(/\s+/);
  const payload: CreateCrewPayload = {
    first_name: firstName || data.name,
    last_name: rest.join(' ') || '-',
    email: data.email,
    weight: data.weight,
    role: data.role,
    pilot_license_number: data.role === 'PILOT' ? 'TEMP-LIC' : null,
    license_valid_until: data.role === 'PILOT' ? data.licenseExpiry : null,
    training_valid_until: data.licenseExpiry,
  };
  return toUiCrew(await request<BackendCrewMember>('/crew-members', 'POST', payload));
};

export const updateCrewMember = async (id: string, data: Partial<CrewMember>): Promise<CrewMember> => {
  const payload: Record<string, unknown> = {};
  if (data.name !== undefined) {
    const [firstName, ...rest] = data.name.trim().split(/\s+/);
    payload.first_name = firstName || data.name;
    payload.last_name = rest.join(' ') || '-';
  }
  if (data.email !== undefined) payload.email = data.email;
  if (data.weight !== undefined) payload.weight = data.weight;
  if (data.role !== undefined) payload.role = data.role;
  if (data.licenseExpiry !== undefined) {
    payload.license_valid_until = data.licenseExpiry;
    payload.training_valid_until = data.licenseExpiry;
  }
  return toUiCrew(await request<BackendCrewMember>(`/crew-members/${id}`, 'PATCH', payload));
};
