import type { LandingSite } from '@/types';
import { toUiSite } from '@/api/mappers';
import { request } from '@/api/http';
import type { BackendLandingSite } from '@/api/types';

type CreateLandingSitePayload = {
  name: string;
  latitude: number;
  longitude: number;
};

export const fetchLandingSites = async (): Promise<LandingSite[]> => {
  const sites = await request<BackendLandingSite[]>('/landing-sites');
  return sites.map(toUiSite);
};

export const createLandingSite = async (data: Omit<LandingSite, 'id'>): Promise<LandingSite> => {
  const payload: CreateLandingSitePayload = {
    name: data.name,
    latitude: data.latitude,
    longitude: data.longitude,
  };
  return toUiSite(await request<BackendLandingSite>('/landing-sites', 'POST', payload));
};

export const updateLandingSite = async (id: string, data: Partial<LandingSite>): Promise<LandingSite> => {
  const payload: Record<string, unknown> = {};
  if (data.name !== undefined) payload.name = data.name;
  if (data.latitude !== undefined) payload.latitude = data.latitude;
  if (data.longitude !== undefined) payload.longitude = data.longitude;
  return toUiSite(await request<BackendLandingSite>(`/landing-sites/${id}`, 'PATCH', payload));
};
