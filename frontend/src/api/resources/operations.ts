import type { PlannedOperation } from '@/types';
import { toUiOperation } from '@/api/mappers';
import { request } from '@/api/http';
import type { BackendPlannedOperation } from '@/api/types';

type CreateOperationPayload = {
  project_code: string;
  short_description: string;
  proposed_date_from: string | null;
  proposed_date_to: string | null;
  planned_date_from: string | null;
  planned_date_to: string | null;
  activities: Array<{ name: string }>;
  extra_info: null;
  contacts: unknown[];
};

export const fetchOperations = async (): Promise<PlannedOperation[]> => {
  const operations = await request<BackendPlannedOperation[]>('/planned-operations');
  return operations.map(toUiOperation);
};

export const createOperation = async (data: Omit<PlannedOperation, 'id'>): Promise<PlannedOperation> => {
  const payload: CreateOperationPayload = {
    project_code: data.projectCode,
    short_description: data.description,
    proposed_date_from: data.startDate || null,
    proposed_date_to: data.endDate || null,
    planned_date_from: data.startDate || null,
    planned_date_to: data.endDate || null,
    activities: data.activities.map((name) => ({ name })),
    extra_info: null,
    contacts: [],
  };
  return toUiOperation(await request<BackendPlannedOperation>('/planned-operations', 'POST', payload));
};

export const updateOperation = async (id: string, data: Partial<PlannedOperation>): Promise<PlannedOperation> => {
  if (data.status !== undefined && Object.keys(data).length === 1) {
    return toUiOperation(await request<BackendPlannedOperation>(`/planned-operations/${id}/status`, 'POST', { status: data.status }));
  }

  const payload: Record<string, unknown> = {};
  if (data.description !== undefined) payload.short_description = data.description;
  if (data.startDate !== undefined) payload.planned_date_from = data.startDate;
  if (data.endDate !== undefined) payload.planned_date_to = data.endDate;
  if (data.activities !== undefined) payload.activities = data.activities.map((name) => ({ name }));
  return toUiOperation(await request<BackendPlannedOperation>(`/planned-operations/${id}`, 'PATCH', payload));
};
