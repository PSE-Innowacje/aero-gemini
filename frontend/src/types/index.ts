export type Role = 'ADMIN' | 'PLANNER' | 'SUPERVISOR' | 'PILOT';
export type CrewRole = 'PILOT' | 'OBSERVER' | 'CREW';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  token?: string;
}

export interface Helicopter {
  id: string;
  registration: string;
  type: string;
  status: 'active' | 'maintenance' | 'inactive';
  maxRange: number;
  maxWeight: number;
}

export interface CrewMember {
  id: string;
  email: string;
  name: string;
  role: CrewRole;
  licenseExpiry: string;
  pilotLicenseNumber?: string | null;
  licenseValidUntil?: string | null;
  trainingValidUntil: string;
  weight: number;
}

export interface LandingSite {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  elevation?: number;
  status?: 'active' | 'inactive';
}

export type OperationStatus = 1 | 2 | 3 | 4 | 5;
export const operationStatusLabels: Record<OperationStatus, string> = {
  1: 'Draft',
  2: 'Submitted',
  3: 'Approved',
  4: 'In Progress',
  5: 'Completed',
};

/** GeoJSON LineString from API (coordinates are [longitude, latitude]). */
export interface OperationRouteGeometry {
  type: 'LineString';
  coordinates: [number, number][];
}

export interface PlannedOperation {
  id: string;
  projectCode: string;
  activities: string[];
  startDate: string;
  endDate: string;
  status: OperationStatus;
  description: string;
  kmlData?: string;
  routeGeometry?: OperationRouteGeometry | null;
}

export type FlightOrderStatus = 1 | 2 | 3 | 4;
export const flightOrderStatusLabels: Record<FlightOrderStatus, string> = {
  1: 'Draft',
  2: 'Pending',
  3: 'Approved',
  4: 'Completed',
};

export interface FlightOrder {
  id: string;
  startTime: string;
  helicopterId: string;
  pilotId: string;
  crewIds: string[];
  landingSiteIds: string[];
  operationIds: string[];
  status: FlightOrderStatus;
  startSiteId: string;
  endSiteId: string;
}
