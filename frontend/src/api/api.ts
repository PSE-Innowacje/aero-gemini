import type {
  CrewMember,
  FlightOrder,
  FlightOrderPreview,
  Helicopter,
  LandingSite,
  PlannedOperation,
  Role,
  User,
} from '@/types';
import { getApiToken } from '@/api/token';

const API_BASE_URL =
  (import.meta as ImportMeta & { env?: { VITE_API_BASE_URL?: string } }).env?.VITE_API_BASE_URL ||
  'http://localhost:8000/api';

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
type LegacyActivityItem = string | { name?: unknown } | null | undefined;

const operationActivityCanonicalValues = [
  'ogledziny_wizualne',
  'skan_3d',
  'lokalizacja_awarii',
  'zdjecia',
  'patrolowanie',
  'survey',
] as const;

type OperationActivityValue = (typeof operationActivityCanonicalValues)[number];

const operationActivityAliasEntries: ReadonlyArray<readonly [string, OperationActivityValue]> = [
  ['oględziny wizualne', 'ogledziny_wizualne'],
  ['ogledzinywizualne', 'ogledziny_wizualne'],
  ['skan 3d', 'skan_3d'],
  ['skan3d', 'skan_3d'],
  ['lokalizacja awarii', 'lokalizacja_awarii'],
  ['zdjęcia', 'zdjecia'],
];

const operationActivityAliases: Record<string, OperationActivityValue> = (() => {
  const aliases: Record<string, OperationActivityValue> = {};
  operationActivityCanonicalValues.forEach((value) => {
    aliases[value] = value;
  });
  operationActivityAliasEntries.forEach(([alias, value]) => {
    aliases[alias] = value;
  });
  return aliases;
})();

const normalizeOperationActivity = (value: LegacyActivityItem): string | null => {
  const rawValue = typeof value === 'object' && value !== null && 'name' in value
    ? value.name
    : value;
  if (typeof rawValue !== 'string') return null;
  const trimmed = rawValue.trim();
  if (!trimmed) return null;
  const normalizedKey = trimmed.toLowerCase();
  return operationActivityAliases[normalizedKey] ?? normalizedKey;
};

const withAuthHeaders = (): HeadersInit => {
  const token = getApiToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const handleUnauthorized = () => {
  localStorage.removeItem('auth-storage');
  // Force a clean auth state so stale/invalid token cannot keep app "logged in".
  window.location.assign('/login');
};

const toApiErrorMessage = (payload: any, fallback: string): string => {
  const detail = payload?.detail;
  if (typeof detail === 'string' && detail.trim()) return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    const formatted = detail
      .map((item: any) => {
        if (typeof item === 'string') return item;
        const message = typeof item?.msg === 'string' ? item.msg : null;
        const location = Array.isArray(item?.loc)
          ? item.loc
              .filter((part: unknown) => typeof part === 'string' && !['body', 'query', 'path'].includes(part))
              .join('.')
          : '';
        if (message && location) return `${location}: ${message}`;
        return message;
      })
      .filter((part: unknown): part is string => typeof part === 'string' && part.trim().length > 0);

    if (formatted.length > 0) return formatted.join(' | ');
  }
  if (typeof payload?.message === 'string' && payload.message.trim()) return payload.message;
  if (typeof payload?.error === 'string' && payload.error.trim()) return payload.error;
  return fallback;
};

async function request<T>(
  path: string,
  method: Method = 'GET',
  body?: unknown,
  options?: { signal?: AbortSignal }
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...withAuthHeaders(),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: options?.signal,
  });
  if (response.status === 401) {
    handleUnauthorized();
    throw new Error('Session expired. Please log in again.');
  }
  if (!response.ok) {
    const fallback = `Request failed (${response.status})`;
    let message = fallback;
    try {
      const payload = await response.json();
      message = toApiErrorMessage(payload, fallback);
    } catch {
      message = fallback;
    }
    throw new Error(message);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
}

async function requestMultipart<T>(path: string, formData: FormData): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      ...withAuthHeaders(),
    },
    body: formData,
  });
  if (response.status === 401) {
    handleUnauthorized();
    throw new Error('Session expired. Please log in again.');
  }
  if (!response.ok) {
    const fallback = `Request failed (${response.status})`;
    let message = fallback;
    try {
      const payload = await response.json();
      message = toApiErrorMessage(payload, fallback);
    } catch {
      message = fallback;
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

const toUiHelicopter = (h: any): Helicopter => ({
  id: String(h.id),
  registration: h.registration_number,
  type: h.type,
  description: h.description ?? '',
  maxCrew: Number(h.max_crew ?? 1),
  status: h.status === 'active' ? 'active' : 'inactive',
  inspectionValidUntil: h.inspection_valid_until ?? null,
  maxRange: h.range_km,
  maxWeight: h.max_crew_weight,
});

const toUiCrew = (c: any): CrewMember => ({
  id: String(c.id),
  email: c.email,
  name: `${c.first_name} ${c.last_name}`.trim(),
  role: c.role,
  licenseExpiry: c.license_valid_until ?? c.training_valid_until,
  pilotLicenseNumber: c.pilot_license_number ?? null,
  licenseValidUntil: c.license_valid_until ?? null,
  trainingValidUntil: c.training_valid_until,
  weight: c.weight,
});

const toUiSite = (s: any): LandingSite => ({
  id: String(s.id),
  name: s.name,
  latitude: s.latitude,
  longitude: s.longitude,
  elevation: 0,
  status: 'active',
});

const toUiOperation = (o: any): PlannedOperation => ({
  id: String(o.id),
  projectCode: o.project_code,
  activities: Array.isArray(o.activities)
    ? o.activities
        .map((value: LegacyActivityItem) => normalizeOperationActivity(value))
        .filter((value: string | null): value is string => value !== null)
    : [],
  proposedDateFrom: o.proposed_date_from ?? '',
  proposedDateTo: o.proposed_date_to ?? '',
  plannedDateFrom: o.planned_date_from ?? '',
  plannedDateTo: o.planned_date_to ?? '',
  status: o.status,
  shortDescription: o.short_description ?? '',
  extraInfo: o.extra_info ?? '',
  distanceKm: Number(o.distance_km ?? 0),
  pointsCount: Number(o.points_count ?? 0),
  createdBy: String(o.created_by ?? ''),
  createdByEmail: String(o.created_by_email ?? ''),
  contacts: Array.isArray(o.contacts) ? o.contacts.map(String) : [],
  postRealizationNotes: o.post_realization_notes ?? '',
  comments: Array.isArray(o.comments)
    ? o.comments.map((item: any) => ({
        content: String(item?.content ?? ''),
        createdAt: String(item?.created_at ?? ''),
        authorEmail: String(item?.author_email ?? ''),
      }))
    : [],
  history: Array.isArray(o.history)
    ? o.history.map((item: any) => ({
        changedAt: String(item?.changed_at ?? ''),
        actorEmail: String(item?.actor_email ?? ''),
        action: String(item?.action ?? ''),
        beforeSnapshot: item?.before_snapshot ?? null,
        afterSnapshot: item?.after_snapshot ?? null,
      }))
    : [],
  linkedFlightOrderIds: Array.isArray(o.linked_flight_order_ids) ? o.linked_flight_order_ids.map((id: any) => String(id)) : [],
  routeGeometry: o.route_geometry && o.route_geometry.type === 'LineString' && Array.isArray(o.route_geometry.coordinates)
    ? { type: 'LineString', coordinates: o.route_geometry.coordinates as [number, number][] }
    : null,
});

const toUiOrder = (o: any): FlightOrder => ({
  id: String(o.id),
  plannedStart: o.planned_start ?? '',
  plannedEnd: o.planned_end ?? '',
  actualStart: o.actual_start ?? '',
  actualEnd: o.actual_end ?? '',
  helicopterId: String(o.helicopter_id),
  pilotId: String(o.pilot_id),
  crewIds: Array.isArray(o.crew_ids) ? o.crew_ids.map(String) : [],
  landingSiteIds: [String(o.start_site_id), String(o.end_site_id)].filter(Boolean),
  operationIds: Array.isArray(o.planned_operation_ids) ? o.planned_operation_ids.map(String) : [],
  status: o.status,
  startSiteId: String(o.start_site_id),
  endSiteId: String(o.end_site_id),
  crewWeight: Number(o.crew_weight ?? 0),
  estimatedDistance: Number(o.estimated_distance ?? 0),
});

const toUiFlightOrderPreview = (p: any): FlightOrderPreview => ({
  orderedOperationIds: Array.isArray(p.ordered_operations)
    ? p.ordered_operations.map((item: any) => String(item.planned_operation_id))
    : [],
  orderedOperations: Array.isArray(p.ordered_operations)
    ? p.ordered_operations.map((item: any) => ({
        plannedOperationId: String(item.planned_operation_id),
        direction: item.direction === 'reverse' ? 'reverse' : 'forward',
        entryPoint: {
          longitude: Number(item?.entry_point?.longitude ?? 0),
          latitude: Number(item?.entry_point?.latitude ?? 0),
        },
        exitPoint: {
          longitude: Number(item?.exit_point?.longitude ?? 0),
          latitude: Number(item?.exit_point?.latitude ?? 0),
        },
        traversalDistanceKm: Number(item?.traversal_distance_km ?? 0),
      }))
    : [],
  totalDistanceKm: Number(p.total_distance_km ?? 0),
  withinHelicopterRange: Boolean(p.within_helicopter_range),
  rangeMarginKm: Number(p.range_margin_km ?? 0),
  blockingReasons: Array.isArray(p.blocking_reasons) ? p.blocking_reasons.map(String) : [],
  cacheHit: Boolean(p.cache_hit),
});

// Auth
export const loginRequest = (email: string, password: string) =>
  request<{ access_token: string; token_type: string; role: Role; first_name: string }>('/auth/login', 'POST', { email, password });

// Users
export const fetchUsers = async (): Promise<User[]> => {
  const users = await request<any[]>('/users');
  return users.map((u) => ({
    id: String(u.id),
    email: u.email,
    name: `${u.first_name} ${u.last_name}`.trim(),
    role: u.role,
  }));
};

export const createUser = async (data: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: Role;
}): Promise<User> => {
  const MAX_USER_FIELD_LENGTH = 100;
  if (
    data.firstName.length > MAX_USER_FIELD_LENGTH ||
    data.lastName.length > MAX_USER_FIELD_LENGTH ||
    data.email.length > MAX_USER_FIELD_LENGTH
  ) {
    throw new Error(`Imię, nazwisko i e-mail mogą mieć maksymalnie ${MAX_USER_FIELD_LENGTH} znaków.`);
  }
  const created = await request<any>('/users', 'POST', {
    first_name: data.firstName,
    last_name: data.lastName,
    email: data.email,
    password: data.password,
    role: data.role,
  });

  return {
    id: String(created.id),
    email: created.email,
    name: `${created.first_name} ${created.last_name}`.trim(),
    role: created.role,
  };
};

export const deleteUser = async (id: string): Promise<void> => {
  await request<void>(`/users/${id}`, 'DELETE');
};

// Helicopters
export const fetchHelicopters = async (): Promise<Helicopter[]> => (await request<any[]>('/helicopters')).map(toUiHelicopter);
export const createHelicopter = async (data: Omit<Helicopter, 'id'>): Promise<Helicopter> => {
  const payload = {
    registration_number: data.registration,
    type: data.type,
    description: data.description || null,
    max_crew: data.maxCrew,
    max_crew_weight: data.maxWeight,
    status: data.status === 'active' ? 'active' : 'inactive',
    inspection_valid_until: data.status === 'active' ? data.inspectionValidUntil : null,
    range_km: data.maxRange,
  };
  return toUiHelicopter(await request('/helicopters', 'POST', payload));
};
export const updateHelicopter = async (id: string, data: Partial<Helicopter>): Promise<Helicopter> => {
  const payload: Record<string, unknown> = {};
  if (data.registration !== undefined) payload.registration_number = data.registration;
  if (data.type !== undefined) payload.type = data.type;
  if (data.description !== undefined) payload.description = data.description || null;
  if (data.maxCrew !== undefined) payload.max_crew = data.maxCrew;
  if (data.maxWeight !== undefined) payload.max_crew_weight = data.maxWeight;
  if (data.maxRange !== undefined) payload.range_km = data.maxRange;
  if (data.inspectionValidUntil !== undefined) payload.inspection_valid_until = data.inspectionValidUntil;
  if (data.status !== undefined) {
    payload.status = data.status === 'active' ? 'active' : 'inactive';
    if (data.status !== 'active') payload.inspection_valid_until = null;
  }
  return toUiHelicopter(await request(`/helicopters/${id}`, 'PATCH', payload));
};

// Crew
export const fetchCrew = async (): Promise<CrewMember[]> => (await request<any[]>('/crew-members')).map(toUiCrew);
export const createCrewMember = async (data: Omit<CrewMember, 'id'>): Promise<CrewMember> => {
  const [firstName, ...rest] = data.name.trim().split(/\s+/);
  const payload = {
    first_name: firstName || data.name,
    last_name: rest.join(' ') || '-',
    email: data.email,
    weight: data.weight,
    role: data.role,
    pilot_license_number: data.role === 'PILOT' ? data.pilotLicenseNumber : null,
    license_valid_until: data.role === 'PILOT' ? data.licenseExpiry : null,
    training_valid_until: data.licenseExpiry,
  };
  return toUiCrew(await request('/crew-members', 'POST', payload));
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
  if (data.pilotLicenseNumber !== undefined) payload.pilot_license_number = data.pilotLicenseNumber;
  if (data.licenseExpiry !== undefined) {
    payload.license_valid_until = data.licenseExpiry;
    payload.training_valid_until = data.licenseExpiry;
  }
  return toUiCrew(await request(`/crew-members/${id}`, 'PATCH', payload));
};

// Landing Sites
export const fetchLandingSites = async (): Promise<LandingSite[]> => (await request<any[]>('/landing-sites')).map(toUiSite);
export const createLandingSite = async (data: Pick<LandingSite, 'name' | 'latitude' | 'longitude'>): Promise<LandingSite> =>
  toUiSite(await request('/landing-sites', 'POST', { name: data.name, latitude: data.latitude, longitude: data.longitude }));
export const updateLandingSite = async (id: string, data: Partial<LandingSite>): Promise<LandingSite> => {
  const payload: Record<string, unknown> = {};
  if (data.name !== undefined) payload.name = data.name;
  if (data.latitude !== undefined) payload.latitude = data.latitude;
  if (data.longitude !== undefined) payload.longitude = data.longitude;
  return toUiSite(await request(`/landing-sites/${id}`, 'PATCH', payload));
};

// Planned Operations
export const fetchOperations = async (): Promise<PlannedOperation[]> => (await request<any[]>('/planned-operations')).map(toUiOperation);
type PlannedOperationCreateInput = {
  projectCode: string;
  shortDescription: string;
  proposedDateFrom?: string;
  proposedDateTo?: string;
  plannedDateFrom?: string;
  plannedDateTo?: string;
  activities: string[];
  extraInfo?: string;
  contacts?: string[];
};

type PlannedOperationUpdateInput = Partial<PlannedOperationCreateInput> & {
  postRealizationNotes?: string;
  comment?: string;
  status?: number;
};

export const createOperation = async (data: PlannedOperationCreateInput): Promise<PlannedOperation> => {
  const activities = data.activities
    .map((value) => normalizeOperationActivity(value))
    .filter((value): value is string => value !== null);
  const payload = {
    project_code: data.projectCode,
    short_description: data.shortDescription,
    proposed_date_from: data.proposedDateFrom || null,
    proposed_date_to: data.proposedDateTo || null,
    planned_date_from: data.plannedDateFrom || null,
    planned_date_to: data.plannedDateTo || null,
    activities,
    extra_info: data.extraInfo || null,
    contacts: data.contacts ?? [],
  };
  return toUiOperation(await request('/planned-operations', 'POST', payload));
};
export const createOperationFromKml = async (
  data: PlannedOperationCreateInput,
  file: File
): Promise<PlannedOperation> => {
  const activities = data.activities
    .map((value) => normalizeOperationActivity(value))
    .filter((value): value is string => value !== null);
  const payload = {
    project_code: data.projectCode,
    short_description: data.shortDescription,
    proposed_date_from: data.proposedDateFrom || null,
    proposed_date_to: data.proposedDateTo || null,
    planned_date_from: data.plannedDateFrom || null,
    planned_date_to: data.plannedDateTo || null,
    activities,
    extra_info: data.extraInfo || null,
    contacts: data.contacts ?? [],
  };
  const formData = new FormData();
  formData.append('payload_json', JSON.stringify(payload));
  formData.append('kml_file', file);
  return toUiOperation(await requestMultipart('/planned-operations/upload-kml', formData));
};
export const updateOperation = async (id: string, data: PlannedOperationUpdateInput): Promise<PlannedOperation> => {
  if (data.status !== undefined && Object.keys(data).length === 1) {
    return toUiOperation(await request(`/planned-operations/${id}/status`, 'POST', { status: data.status }));
  }
  const payload: Record<string, unknown> = {};
  const typed = data as PlannedOperationUpdateInput;
  if (typed.projectCode !== undefined) payload.project_code = typed.projectCode;
  if (typed.shortDescription !== undefined) payload.short_description = typed.shortDescription;
  if (typed.proposedDateFrom !== undefined) payload.proposed_date_from = typed.proposedDateFrom || null;
  if (typed.proposedDateTo !== undefined) payload.proposed_date_to = typed.proposedDateTo || null;
  if (typed.plannedDateFrom !== undefined) payload.planned_date_from = typed.plannedDateFrom || null;
  if (typed.plannedDateTo !== undefined) payload.planned_date_to = typed.plannedDateTo || null;
  if (typed.activities !== undefined) {
    payload.activities = typed.activities
      .map((value) => normalizeOperationActivity(value))
      .filter((value): value is string => value !== null);
  }
  if (typed.extraInfo !== undefined) payload.extra_info = typed.extraInfo || null;
  if (typed.contacts !== undefined) payload.contacts = typed.contacts;
  if (typed.postRealizationNotes !== undefined) payload.post_realization_notes = typed.postRealizationNotes || null;
  if (typed.comment !== undefined) payload.comment = typed.comment || null;
  return toUiOperation(await request(`/planned-operations/${id}`, 'PATCH', payload));
};

// Flight Orders
export const fetchFlightOrders = async (): Promise<FlightOrder[]> => (await request<any[]>('/flight-orders')).map(toUiOrder);

export const estimateFlightOrderDistanceKm = async (data: {
  startSiteId: string;
  endSiteId: string;
  operationIds: string[];
}): Promise<number> => {
  const body = {
    start_site_id: Number(data.startSiteId),
    end_site_id: Number(data.endSiteId),
    planned_operation_ids: data.operationIds.length ? data.operationIds.map(Number) : [],
  };
  const res = await request<{ distance_km: number }>('/flight-orders/estimate-distance', 'POST', body);
  return res.distance_km;
};

export const previewFlightOrderRoute = async (
  data: {
    startSiteId: string;
    endSiteId: string;
    helicopterId: string;
    operationIds: string[];
    strategy?: 'optimized' | 'input_order';
  },
  signal?: AbortSignal
): Promise<FlightOrderPreview> => {
  const body = {
    start_site_id: Number(data.startSiteId),
    end_site_id: Number(data.endSiteId),
    helicopter_id: Number(data.helicopterId),
    planned_operation_ids: data.operationIds.map(Number),
    strategy: data.strategy ?? 'optimized',
  };
  const response = await request('/flight-orders/preview', 'POST', body, { signal });
  return toUiFlightOrderPreview(response);
};

export const createFlightOrder = async (data: Omit<FlightOrder, 'id'>): Promise<FlightOrder> => {
  const preview = await previewFlightOrderRoute({
    startSiteId: data.startSiteId,
    endSiteId: data.endSiteId,
    helicopterId: data.helicopterId,
    operationIds: data.operationIds,
  });
  if (!preview.withinHelicopterRange) {
    throw new Error(
      `Selected operations exceed helicopter range by ${Math.abs(preview.rangeMarginKm).toFixed(2)} km`
    );
  }
  const payload = {
    planned_start: data.plannedStart || null,
    planned_end: data.plannedEnd || null,
    ...(data.pilotId ? { pilot_id: Number(data.pilotId) } : {}),
    helicopter_id: Number(data.helicopterId),
    crew_ids: data.crewIds.map(Number),
    start_site_id: Number(data.startSiteId),
    end_site_id: Number(data.endSiteId),
    planned_operation_ids: preview.orderedOperationIds.map(Number),
    estimated_distance: preview.totalDistanceKm,
  };
  return toUiOrder(await request('/flight-orders', 'POST', payload));
};
export const updateFlightOrder = async (id: string, data: Partial<FlightOrder>): Promise<FlightOrder> => {
  const payload: Record<string, unknown> = {};
  if (data.plannedStart !== undefined) payload.planned_start = data.plannedStart || null;
  if (data.plannedEnd !== undefined) payload.planned_end = data.plannedEnd || null;
  if (data.actualStart !== undefined) payload.actual_start = data.actualStart || null;
  if (data.actualEnd !== undefined) payload.actual_end = data.actualEnd || null;
  if (data.pilotId !== undefined) payload.pilot_id = Number(data.pilotId);
  if (data.helicopterId !== undefined) payload.helicopter_id = Number(data.helicopterId);
  if (data.crewIds !== undefined) payload.crew_ids = data.crewIds.map(Number);
  if (data.startSiteId !== undefined) payload.start_site_id = Number(data.startSiteId);
  if (data.endSiteId !== undefined) payload.end_site_id = Number(data.endSiteId);
  if (data.status !== undefined) payload.status = data.status;
  if (data.operationIds !== undefined) payload.planned_operation_ids = data.operationIds.map(Number);
  return toUiOrder(await request(`/flight-orders/${id}`, 'PATCH', payload));
};

export const deleteFlightOrder = async (id: string): Promise<void> => {
  await request<void>(`/flight-orders/${id}`, 'DELETE');
};
