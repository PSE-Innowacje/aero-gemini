import type { CrewMember, FlightOrder, Helicopter, LandingSite, PlannedOperation, User } from '@/types';
import type {
  BackendCrewMember,
  BackendFlightOrder,
  BackendHelicopter,
  BackendLandingSite,
  BackendOperationActivity,
  BackendPlannedOperation,
  BackendUser,
} from '@/api/types';

const toActivityName = (value: BackendOperationActivity): string => {
  if (typeof value === 'string') {
    return value;
  }
  return String(value.name ?? '');
};

export const toUiHelicopter = (helicopter: BackendHelicopter): Helicopter => ({
  id: String(helicopter.id),
  registration: helicopter.registration_number,
  type: helicopter.type,
  status: helicopter.status === 'active' ? 'active' : 'inactive',
  maxRange: helicopter.range_km,
  maxWeight: helicopter.max_crew_weight,
});

export const toUiCrew = (crewMember: BackendCrewMember): CrewMember => ({
  id: String(crewMember.id),
  email: crewMember.email,
  name: `${crewMember.first_name} ${crewMember.last_name}`.trim(),
  role: crewMember.role,
  licenseExpiry: crewMember.license_valid_until ?? crewMember.training_valid_until,
  pilotLicenseNumber: crewMember.pilot_license_number ?? null,
  licenseValidUntil: crewMember.license_valid_until ?? null,
  trainingValidUntil: crewMember.training_valid_until,
  weight: crewMember.weight,
});

export const toUiSite = (site: BackendLandingSite): LandingSite => ({
  id: String(site.id),
  name: site.name,
  latitude: site.latitude,
  longitude: site.longitude,
  elevation: 0,
  status: 'active',
});

export const toUiOperation = (operation: BackendPlannedOperation): PlannedOperation => ({
  id: String(operation.id),
  projectCode: operation.project_code,
  activities: Array.isArray(operation.activities) ? operation.activities.map(toActivityName) : [],
  startDate: operation.planned_date_from ?? operation.proposed_date_from ?? '',
  endDate: operation.planned_date_to ?? operation.proposed_date_to ?? '',
  status: operation.status,
  description: operation.short_description,
});

export const toUiOrder = (order: BackendFlightOrder): FlightOrder => ({
  id: String(order.id),
  startTime: order.planned_start ?? '',
  helicopterId: String(order.helicopter_id),
  pilotId: String(order.pilot_id),
  crewIds: Array.isArray(order.crew_ids) ? order.crew_ids.map(String) : [],
  landingSiteIds: [String(order.start_site_id), String(order.end_site_id)].filter(Boolean),
  operationIds: Array.isArray(order.planned_operation_ids) ? order.planned_operation_ids.map(String) : [],
  status: order.status as FlightOrder['status'],
  startSiteId: String(order.start_site_id),
  endSiteId: String(order.end_site_id),
});

export const toUiUser = (user: BackendUser): User => ({
  id: String(user.id),
  email: user.email,
  name: `${user.first_name} ${user.last_name}`.trim(),
  role: user.role,
});
