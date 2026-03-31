import type { FlightOrder, LandingSite, PlannedOperation } from '@/types';

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
