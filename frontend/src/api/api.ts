import type { Helicopter, CrewMember, LandingSite, PlannedOperation, FlightOrder } from '@/types';
import { helicopters, crewMembers, landingSites, plannedOperations, flightOrders } from './mockData';

const delay = (ms = 300) => new Promise(r => setTimeout(r, ms));

// Helicopters
export const fetchHelicopters = async (): Promise<Helicopter[]> => { await delay(); return [...helicopters]; };
export const createHelicopter = async (data: Omit<Helicopter, 'id'>): Promise<Helicopter> => {
  await delay();
  const item = { ...data, id: String(helicopters.length + 1) };
  helicopters.push(item);
  return item;
};
export const updateHelicopter = async (id: string, data: Partial<Helicopter>): Promise<Helicopter> => {
  await delay();
  const idx = helicopters.findIndex(h => h.id === id);
  if (idx === -1) throw new Error('Not found');
  helicopters[idx] = { ...helicopters[idx], ...data };
  return helicopters[idx];
};

// Crew
export const fetchCrew = async (): Promise<CrewMember[]> => { await delay(); return [...crewMembers]; };
export const createCrewMember = async (data: Omit<CrewMember, 'id'>): Promise<CrewMember> => {
  await delay();
  const item = { ...data, id: String(crewMembers.length + 1) };
  crewMembers.push(item);
  return item;
};
export const updateCrewMember = async (id: string, data: Partial<CrewMember>): Promise<CrewMember> => {
  await delay();
  const idx = crewMembers.findIndex(c => c.id === id);
  if (idx === -1) throw new Error('Not found');
  crewMembers[idx] = { ...crewMembers[idx], ...data };
  return crewMembers[idx];
};

// Landing Sites
export const fetchLandingSites = async (): Promise<LandingSite[]> => { await delay(); return [...landingSites]; };
export const createLandingSite = async (data: Omit<LandingSite, 'id'>): Promise<LandingSite> => {
  await delay();
  const item = { ...data, id: String(landingSites.length + 1) };
  landingSites.push(item);
  return item;
};
export const updateLandingSite = async (id: string, data: Partial<LandingSite>): Promise<LandingSite> => {
  await delay();
  const idx = landingSites.findIndex(s => s.id === id);
  if (idx === -1) throw new Error('Not found');
  landingSites[idx] = { ...landingSites[idx], ...data };
  return landingSites[idx];
};

// Planned Operations
export const fetchOperations = async (): Promise<PlannedOperation[]> => { await delay(); return [...plannedOperations]; };
export const createOperation = async (data: Omit<PlannedOperation, 'id'>): Promise<PlannedOperation> => {
  await delay();
  const item = { ...data, id: String(plannedOperations.length + 1) };
  plannedOperations.push(item);
  return item;
};
export const updateOperation = async (id: string, data: Partial<PlannedOperation>): Promise<PlannedOperation> => {
  await delay();
  const idx = plannedOperations.findIndex(o => o.id === id);
  if (idx === -1) throw new Error('Not found');
  plannedOperations[idx] = { ...plannedOperations[idx], ...data };
  return plannedOperations[idx];
};

// Flight Orders
export const fetchFlightOrders = async (): Promise<FlightOrder[]> => { await delay(); return [...flightOrders]; };
export const createFlightOrder = async (data: Omit<FlightOrder, 'id'>): Promise<FlightOrder> => {
  await delay();
  const item = { ...data, id: String(flightOrders.length + 1) };
  flightOrders.push(item);
  return item;
};
export const updateFlightOrder = async (id: string, data: Partial<FlightOrder>): Promise<FlightOrder> => {
  await delay();
  const idx = flightOrders.findIndex(f => f.id === id);
  if (idx === -1) throw new Error('Not found');
  flightOrders[idx] = { ...flightOrders[idx], ...data };
  return flightOrders[idx];
};
