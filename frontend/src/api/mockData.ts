import type { Helicopter, CrewMember, LandingSite, PlannedOperation, FlightOrder } from '@/types';

export const helicopters: Helicopter[] = [
  { id: '1', registration: 'SP-HEL1', type: 'EC135', status: 'active', maxRange: 620, maxWeight: 2910 },
  { id: '2', registration: 'SP-HEL2', type: 'Bell 407', status: 'active', maxRange: 685, maxWeight: 2722 },
  { id: '3', registration: 'SP-HEL3', type: 'AW139', status: 'maintenance', maxRange: 1060, maxWeight: 6400 },
  { id: '4', registration: 'SP-HEL4', type: 'H145', status: 'inactive', maxRange: 680, maxWeight: 3700 },
];

export const crewMembers: CrewMember[] = [
  { id: '1', email: 'pilot1@heli.app', name: 'Marek Zieliński', role: 'PILOT', licenseExpiry: '2026-08-15', weight: 82 },
  { id: '2', email: 'pilot2@heli.app', name: 'Tomasz Kaczmarek', role: 'PILOT', licenseExpiry: '2025-12-01', weight: 78 },
  { id: '3', email: 'crew1@heli.app', name: 'Ewa Lewandowska', role: 'SUPERVISOR', licenseExpiry: '2026-06-30', weight: 65 },
  { id: '4', email: 'crew2@heli.app', name: 'Karol Dąbrowski', role: 'PLANNER', licenseExpiry: '2026-03-20', weight: 90 },
];

export const landingSites: LandingSite[] = [
  { id: '1', name: 'Baza Główna Kraków', latitude: 50.0647, longitude: 19.9450, elevation: 237, status: 'active' },
  { id: '2', name: 'Lądowisko Zakopane', latitude: 49.2992, longitude: 19.9496, elevation: 838, status: 'active' },
  { id: '3', name: 'Punkt Tarnów', latitude: 50.0121, longitude: 20.9858, elevation: 209, status: 'active' },
  { id: '4', name: 'Helipad Katowice', latitude: 50.2649, longitude: 19.0238, elevation: 310, status: 'inactive' },
];

export const plannedOperations: PlannedOperation[] = [
  { id: '1', projectCode: 'PRJ-2026-001', activities: ['Survey', 'Transport'], startDate: '2026-04-10', endDate: '2026-04-15', status: 3, description: 'Aerial survey of power lines sector A.' },
  { id: '2', projectCode: 'PRJ-2026-002', activities: ['Rescue', 'Medical'], startDate: '2026-04-20', endDate: '2026-04-22', status: 2, description: 'Emergency medical evacuation drill.' },
  { id: '3', projectCode: 'PRJ-2026-003', activities: ['Transport'], startDate: '2026-05-01', endDate: '2026-05-05', status: 3, description: 'Personnel transport to mountain base.' },
  { id: '4', projectCode: 'PRJ-2026-004', activities: ['Survey', 'Photography'], startDate: '2026-05-10', endDate: '2026-05-12', status: 1, description: 'Photographic documentation of construction site.' },
];

export const flightOrders: FlightOrder[] = [
  { id: '1', startTime: '2026-04-10T08:00', helicopterId: '1', pilotId: '1', crewIds: ['3'], landingSiteIds: ['1', '2'], operationIds: ['1'], status: 2, startSiteId: '1', endSiteId: '2' },
  { id: '2', startTime: '2026-04-21T06:30', helicopterId: '2', pilotId: '2', crewIds: ['3', '4'], landingSiteIds: ['1', '3'], operationIds: ['2'], status: 2, startSiteId: '1', endSiteId: '3' },
  { id: '3', startTime: '2026-05-02T09:00', helicopterId: '3', pilotId: '1', crewIds: ['4'], landingSiteIds: ['1', '2', '3'], operationIds: ['3'], status: 1, startSiteId: '1', endSiteId: '2' },
];
