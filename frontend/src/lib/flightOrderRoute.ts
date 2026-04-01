import type {
  FlightOrder,
  FlightOrderPreviewOperation,
  LandingSite,
  PlannedOperation,
} from '@/types';

/** GeoJSON LineString coordinates: [longitude, latitude][] */
function appendOperationCoordinates(
  positions: [number, number][],
  coordinates: unknown
): void {
  if (!Array.isArray(coordinates)) return;
  for (const pair of coordinates) {
    if (!Array.isArray(pair) || pair.length < 2) continue;
    const lon = Number(pair[0]);
    const lat = Number(pair[1]);
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      positions.push([lat, lon]);
    }
  }
}

function dedupeConsecutivePositions(positions: [number, number][]): [number, number][] {
  const out: [number, number][] = [];
  for (const p of positions) {
    const last = out[out.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) {
      out.push(p);
    }
  }
  return out;
}

function pointsEqual(a: [number, number], b: [number, number]): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

function normalizeOperationPositions(coordinates: unknown): [number, number][] {
  const out: [number, number][] = [];
  appendOperationCoordinates(out, coordinates);
  return dedupeConsecutivePositions(out);
}

function reversePositions(positions: [number, number][]): [number, number][] {
  return [...positions].reverse();
}

export interface FlightRouteOperationMarker {
  id: string;
  lat: number;
  lng: number;
  popup: string;
}

export interface FlightRouteVisuals {
  transitPolylines: [number, number][][];
  operationPolylines: [number, number][][];
  operationMarkers: FlightRouteOperationMarker[];
}

function resolveOperationPositions(
  opById: Map<string, PlannedOperation>,
  operationId: string,
  direction: 'forward' | 'reverse' = 'forward'
): [number, number][] {
  const op = opById.get(operationId);
  const positions = normalizeOperationPositions(op?.routeGeometry?.coordinates);
  if (positions.length === 0) return positions;
  return direction === 'reverse' ? reversePositions(positions) : positions;
}

/**
 * Leaflet polyline: [latitude, longitude][].
 * Path: start landing site → each selected operation's route_geometry.coordinates (in order)End landing site.
 */
export function buildFlightOrderPolylinePositions(
  order: FlightOrder,
  sites: LandingSite[],
  operations: PlannedOperation[]
): [number, number][] | null {
  return buildFlightPreviewPolylinePositions(
    order.startSiteId,
    order.endSiteId,
    order.operationIds,
    sites,
    operations
  );
}

export function buildFlightPreviewPolylinePositions(
  startSiteId: string,
  endSiteId: string,
  operationIds: string[],
  sites: LandingSite[],
  operations: PlannedOperation[]
): [number, number][] | null {
  const startSite = sites.find(s => s.id === startSiteId);
  const endSite = sites.find(s => s.id === endSiteId);
  if (!startSite || !endSite) return null;

  const positions: [number, number][] = [[startSite.latitude, startSite.longitude]];

  const opById = new Map(operations.map((o) => [o.id, o]));
  for (const opId of operationIds) {
    const op = opById.get(opId);
    const coords = op?.routeGeometry?.coordinates;
    if (!coords?.length) continue;
    appendOperationCoordinates(positions, coords);
  }

  positions.push([endSite.latitude, endSite.longitude]);

  return dedupeConsecutivePositions(positions);
}

export function buildFlightPreviewPolylinePositionsFromOrderedOperations(
  startSiteId: string,
  endSiteId: string,
  orderedOperations: FlightOrderPreviewOperation[],
  sites: LandingSite[],
  operations: PlannedOperation[]
): [number, number][] | null {
  const startSite = sites.find((s) => s.id === startSiteId);
  const endSite = sites.find((s) => s.id === endSiteId);
  if (!startSite || !endSite) return null;

  const positions: [number, number][] = [[startSite.latitude, startSite.longitude]];
  const opById = new Map(operations.map((o) => [o.id, o]));

  for (const orderedOperation of orderedOperations) {
    const opPositions = resolveOperationPositions(
      opById,
      orderedOperation.plannedOperationId,
      orderedOperation.direction
    );
    for (const point of opPositions) positions.push(point);
  }

  positions.push([endSite.latitude, endSite.longitude]);
  return dedupeConsecutivePositions(positions);
}

export function buildFlightPreviewRouteVisuals(
  startSiteId: string,
  endSiteId: string,
  operationIds: string[],
  sites: LandingSite[],
  operations: PlannedOperation[]
): FlightRouteVisuals | null {
  const startSite = sites.find((s) => s.id === startSiteId);
  const endSite = sites.find((s) => s.id === endSiteId);
  if (!startSite || !endSite) return null;

  const opById = new Map(operations.map((o) => [o.id, o]));
  const transitPolylines: [number, number][][] = [];
  const operationPolylines: [number, number][][] = [];
  const operationMarkers: FlightRouteOperationMarker[] = [];

  let cursor: [number, number] = [startSite.latitude, startSite.longitude];

  for (const opId of operationIds) {
    const op = opById.get(opId);
    const opPositions = normalizeOperationPositions(op?.routeGeometry?.coordinates);
    if (opPositions.length === 0) continue;

    const first = opPositions[0];
    const last = opPositions[opPositions.length - 1];

    if (!pointsEqual(cursor, first)) {
      transitPolylines.push([cursor, first]);
    }

    if (opPositions.length >= 2) {
      operationPolylines.push(opPositions);
    }

    const markerPoint = opPositions[Math.floor(opPositions.length / 2)];
    operationMarkers.push({
      id: `op-${opId}`,
      lat: markerPoint[0],
      lng: markerPoint[1],
      popup: op?.projectCode ? `Odcinek operacji: ${op.projectCode}` : `Odcinek operacji ${opId}`,
    });

    cursor = last;
  }

  const endPoint: [number, number] = [endSite.latitude, endSite.longitude];
  if (!pointsEqual(cursor, endPoint)) {
    transitPolylines.push([cursor, endPoint]);
  }

  if (operationPolylines.length === 0 && transitPolylines.length === 0) {
    transitPolylines.push([[startSite.latitude, startSite.longitude], endPoint]);
  }

  return { transitPolylines, operationPolylines, operationMarkers };
}

export function buildFlightPreviewRouteVisualsFromOrderedOperations(
  startSiteId: string,
  endSiteId: string,
  orderedOperations: FlightOrderPreviewOperation[],
  sites: LandingSite[],
  operations: PlannedOperation[]
): FlightRouteVisuals | null {
  const startSite = sites.find((s) => s.id === startSiteId);
  const endSite = sites.find((s) => s.id === endSiteId);
  if (!startSite || !endSite) return null;

  const opById = new Map(operations.map((o) => [o.id, o]));
  const transitPolylines: [number, number][][] = [];
  const operationPolylines: [number, number][][] = [];
  const operationMarkers: FlightRouteOperationMarker[] = [];

  let cursor: [number, number] = [startSite.latitude, startSite.longitude];

  for (const orderedOperation of orderedOperations) {
    const operationId = orderedOperation.plannedOperationId;
    const op = opById.get(operationId);
    const opPositions = resolveOperationPositions(opById, operationId, orderedOperation.direction);
    if (opPositions.length === 0) continue;

    const first = opPositions[0];
    const last = opPositions[opPositions.length - 1];

    if (!pointsEqual(cursor, first)) {
      transitPolylines.push([cursor, first]);
    }

    if (opPositions.length >= 2) {
      operationPolylines.push(opPositions);
    }

    const markerPoint = opPositions[Math.floor(opPositions.length / 2)];
    const directionLabel = orderedOperation.direction === 'reverse' ? ' (kierunek odwrotny)' : '';
    operationMarkers.push({
      id: `op-${operationId}`,
      lat: markerPoint[0],
      lng: markerPoint[1],
      popup: op?.projectCode
        ? `Odcinek operacji: ${op.projectCode}${directionLabel}`
        : `Odcinek operacji ${operationId}${directionLabel}`,
    });

    cursor = last;
  }

  const endPoint: [number, number] = [endSite.latitude, endSite.longitude];
  if (!pointsEqual(cursor, endPoint)) {
    transitPolylines.push([cursor, endPoint]);
  }

  if (operationPolylines.length === 0 && transitPolylines.length === 0) {
    transitPolylines.push([[startSite.latitude, startSite.longitude], endPoint]);
  }

  return { transitPolylines, operationPolylines, operationMarkers };
}
