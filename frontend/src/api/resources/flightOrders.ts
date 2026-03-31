import type { FlightOrder } from '@/types';
import { toUiOrder } from '@/api/mappers';
import { request } from '@/api/http';
import type { BackendFlightOrder } from '@/api/types';

type CreateFlightOrderPayload = {
  planned_start: string | null;
  planned_end: string | null;
  pilot_id: number;
  helicopter_id: number;
  crew_ids: number[];
  start_site_id: number;
  end_site_id: number;
  planned_operation_ids: number[];
  estimated_distance: number;
};

export const fetchFlightOrders = async (): Promise<FlightOrder[]> => {
  const orders = await request<BackendFlightOrder[]>('/flight-orders');
  return orders.map(toUiOrder);
};

export const createFlightOrder = async (data: Omit<FlightOrder, 'id'>): Promise<FlightOrder> => {
  const payload: CreateFlightOrderPayload = {
    planned_start: data.startTime || null,
    planned_end: data.startTime || null,
    pilot_id: Number(data.pilotId),
    helicopter_id: Number(data.helicopterId),
    crew_ids: data.crewIds.map(Number),
    start_site_id: Number(data.startSiteId),
    end_site_id: Number(data.endSiteId),
    planned_operation_ids: data.operationIds.map(Number),
    estimated_distance: 100,
  };
  return toUiOrder(await request<BackendFlightOrder>('/flight-orders', 'POST', payload));
};

export const updateFlightOrder = async (id: string, data: Partial<FlightOrder>): Promise<FlightOrder> => {
  const payload: Record<string, unknown> = {};
  if (data.startTime !== undefined) {
    payload.planned_start = data.startTime || null;
    payload.planned_end = data.startTime || null;
  }
  if (data.pilotId !== undefined) payload.pilot_id = Number(data.pilotId);
  if (data.helicopterId !== undefined) payload.helicopter_id = Number(data.helicopterId);
  if (data.crewIds !== undefined) payload.crew_ids = data.crewIds.map(Number);
  if (data.startSiteId !== undefined) payload.start_site_id = Number(data.startSiteId);
  if (data.endSiteId !== undefined) payload.end_site_id = Number(data.endSiteId);
  if (data.status !== undefined) payload.status = data.status;
  if (data.operationIds !== undefined) payload.planned_operation_ids = data.operationIds.map(Number);
  return toUiOrder(await request<BackendFlightOrder>(`/flight-orders/${id}`, 'PATCH', payload));
};
