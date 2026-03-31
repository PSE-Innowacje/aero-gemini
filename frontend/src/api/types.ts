import type { CrewRole, OperationStatus, Role } from '@/types';

export type BackendHelicopterStatus = 'active' | 'inactive' | 'maintenance';

export interface BackendHelicopter {
  id: number | string;
  registration_number: string;
  type: string;
  status: BackendHelicopterStatus;
  range_km: number;
  max_crew_weight: number;
}

export interface BackendCrewMember {
  id: number | string;
  email: string;
  first_name: string;
  last_name: string;
  role: CrewRole;
  license_valid_until?: string | null;
  training_valid_until: string;
  pilot_license_number?: string | null;
  weight: number;
}

export interface BackendLandingSite {
  id: number | string;
  name: string;
  latitude: number;
  longitude: number;
}

export type BackendOperationActivity = { name?: string } | string;

export interface BackendPlannedOperation {
  id: number | string;
  project_code: string;
  activities: BackendOperationActivity[];
  planned_date_from?: string | null;
  proposed_date_from?: string | null;
  planned_date_to?: string | null;
  proposed_date_to?: string | null;
  status: OperationStatus;
  short_description: string;
}

export interface BackendFlightOrder {
  id: number | string;
  planned_start?: string | null;
  helicopter_id: number | string;
  pilot_id: number | string;
  crew_ids: Array<number | string>;
  start_site_id: number | string;
  end_site_id: number | string;
  planned_operation_ids: Array<number | string>;
  status: number;
}

export interface BackendUser {
  id: number | string;
  email: string;
  first_name: string;
  last_name: string;
  role: Role;
}
