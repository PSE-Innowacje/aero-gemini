import type { Helicopter } from '@/types';
import { toUiHelicopter } from '@/api/mappers';
import { request } from '@/api/http';
import type { BackendHelicopter } from '@/api/types';

type CreateHelicopterPayload = {
  registration_number: string;
  type: string;
  description: null;
  max_crew: number;
  max_crew_weight: number;
  status: 'active' | 'inactive';
  inspection_valid_until: string | null;
  range_km: number;
};

export const fetchHelicopters = async (): Promise<Helicopter[]> => {
  const helicopters = await request<BackendHelicopter[]>('/helicopters');
  return helicopters.map(toUiHelicopter);
};

export const createHelicopter = async (data: Omit<Helicopter, 'id'>): Promise<Helicopter> => {
  const payload: CreateHelicopterPayload = {
    registration_number: data.registration,
    type: data.type,
    description: null,
    max_crew: 4,
    max_crew_weight: data.maxWeight,
    status: data.status === 'active' ? 'active' : 'inactive',
    inspection_valid_until: data.status === 'active' ? new Date().toISOString().slice(0, 10) : null,
    range_km: data.maxRange,
  };
  return toUiHelicopter(await request<BackendHelicopter>('/helicopters', 'POST', payload));
};

export const updateHelicopter = async (id: string, data: Partial<Helicopter>): Promise<Helicopter> => {
  const payload: Record<string, unknown> = {};
  if (data.registration !== undefined) payload.registration_number = data.registration;
  if (data.type !== undefined) payload.type = data.type;
  if (data.maxWeight !== undefined) payload.max_crew_weight = data.maxWeight;
  if (data.maxRange !== undefined) payload.range_km = data.maxRange;
  if (data.status !== undefined) {
    payload.status = data.status === 'active' ? 'active' : 'inactive';
    payload.inspection_valid_until = data.status === 'active' ? new Date().toISOString().slice(0, 10) : null;
  }
  return toUiHelicopter(await request<BackendHelicopter>(`/helicopters/${id}`, 'PATCH', payload));
};
