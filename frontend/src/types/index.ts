export type Role = 'ADMIN' | 'PLANNER' | 'SUPERVISOR' | 'PILOT';
export type CrewRole = 'PILOT' | 'OBSERVER';

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
  description: string;
  maxCrew: number;
  status: 'active' | 'maintenance' | 'inactive';
  inspectionValidUntil?: string | null;
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

export type OperationStatus = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export const operationStatusLabels: Record<OperationStatus, string> = {
  1: 'Wprowadzone',
  2: 'Odrzucone',
  3: 'Potwierdzone do planu',
  4: 'Zaplanowane do zlecenia',
  5: 'Czesciowo zrealizowane',
  6: 'Zrealizowane',
  7: 'Rezygnacja',
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
  proposedDateFrom: string;
  proposedDateTo: string;
  plannedDateFrom: string;
  plannedDateTo: string;
  status: OperationStatus;
  shortDescription: string;
  extraInfo: string;
  distanceKm: number;
  pointsCount: number;
  createdBy: string;
  createdByEmail: string;
  contacts: string[];
  postRealizationNotes: string;
  comments: { content: string; createdAt: string; authorEmail: string }[];
  history: {
    changedAt: string;
    actorEmail: string;
    action: string;
    beforeSnapshot?: Record<string, unknown> | null;
    afterSnapshot?: Record<string, unknown> | null;
  }[];
  linkedFlightOrderIds: string[];
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

export interface FlightOrderPreviewOperation {
  plannedOperationId: string;
  direction: 'forward' | 'reverse';
  entryPoint: { longitude: number; latitude: number };
  exitPoint: { longitude: number; latitude: number };
  traversalDistanceKm: number;
}

export interface FlightOrderPreview {
  orderedOperationIds: string[];
  orderedOperations: FlightOrderPreviewOperation[];
  totalDistanceKm: number;
  withinHelicopterRange: boolean;
  rangeMarginKm: number;
  blockingReasons: string[];
  cacheHit: boolean;
}
