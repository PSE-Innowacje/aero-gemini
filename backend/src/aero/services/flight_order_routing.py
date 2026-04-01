from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import json
import math

from fastapi import HTTPException, status
from geopy.distance import geodesic
from sqlalchemy import select
from sqlalchemy.orm import Session

from aero.models.landing_site import LandingSite
from aero.models.planned_operation import PlannedOperation

try:
    import elkai  # type: ignore
except Exception:  # pragma: no cover
    elkai = None


LatLon = Tuple[float, float]


@dataclass(frozen=True)
class Segment:
    """
    A route segment parsed from GeoJSON LineString.
    - `points` are in (lat, lon) order
    - `length_m` is geodesic length along the polyline
    """
    name: str
    points: List[LatLon]
    length_m: float

    @property
    def start(self) -> LatLon:
        return self.points[0]

    @property
    def end(self) -> LatLon:
        return self.points[-1]

    @property
    def midpoint(self) -> LatLon:
        # Index midpoint (not geodesic midpoint)
        return self.points[len(self.points) // 2]


@dataclass(frozen=True)
class DirectedSegment:
    """
    A segment with a chosen direction:
    - entry -> exit, and full traversal length
    """
    segment_index: int
    entry: LatLon
    exit: LatLon
    traversal_length_m: float


def geodesic_m(a: LatLon, b: LatLon) -> float:
    return geodesic(a, b).meters


def polyline_length_m(points: List[LatLon]) -> float:
    if len(points) < 2:
        return 0.0
    return sum(geodesic_m(points[i], points[i + 1]) for i in range(len(points) - 1))


def segment_from_linestring(
    coords: List[List[float]],
    name: str,
) -> Segment:
    """
    GeoJSON LineString coordinates are [lon, lat] (optionally [lon, lat, alt]).
    """
    points = [(lat, lon) for lon, lat, *_ in coords]
    length_m = polyline_length_m(points)
    return Segment(name=name, points=points, length_m=length_m)


def parse_geojson_object(obj: Dict[str, Any]) -> List[Segment]:
    """
    Accepts:
    - FeatureCollection
    - Feature (LineString)
    - Geometry (LineString)
    """
    segments: List[Segment] = []

    def handle_geometry(geom: Dict[str, Any], name: str) -> None:
        if geom.get("type") == "LineString":
            coords = geom.get("coordinates", [])
            if coords:
                segments.append(segment_from_linestring(coords, name))
        elif geom.get("type") == "MultiLineString":
            for i, coords in enumerate(geom.get("coordinates", []), start=1):
                segments.append(segment_from_linestring(coords, f"{name}-{i}"))

    if obj.get("type") == "FeatureCollection":
        for f in obj.get("features", []):
            name = f.get("properties", {}).get("name", "segment")
            geom = f.get("geometry")
            if geom:
                handle_geometry(geom, name)

    elif obj.get("type") == "Feature":
        name = obj.get("properties", {}).get("name", "segment")
        geom = obj.get("geometry")
        if geom:
            handle_geometry(geom, name)

    elif obj.get("type") in {"LineString", "MultiLineString"}:
        handle_geometry(obj, "segment")

    return segments


def load_geojson_file(path: Path) -> List[Segment]:
    data = json.loads(path.read_text(encoding="utf-8"))
    return parse_geojson_object(data)


def build_midpoint_distance_matrix(segments: List[Segment]) -> List[List[float]]:
    """
    Symmetric distance matrix between segment midpoints.
    Used for ordering heuristic (TSP).
    """
    n = len(segments)
    matrix = [[0.0 for _ in range(n)] for _ in range(n)]
    for i in range(n):
        for j in range(n):
            if i == j:
                continue
            matrix[i][j] = geodesic_m(segments[i].midpoint, segments[j].midpoint)
    return matrix


def solve_tsp_order(matrix: List[List[float]]) -> List[int]:
    """
    Solve TSP order with Lin–Kernighan (elkai).
    Falls back to a greedy nearest-neighbor if elkai is unavailable.
    """
    n = len(matrix)
    if n == 0:
        return []

    if elkai is not None:
        int_matrix = [[int(math.ceil(d)) for d in row] for row in matrix]
        order = elkai.solve_int_matrix(int_matrix)
        return list(order)

    # Fallback: deterministic nearest-neighbor.
    # Evaluate all possible starts so result is not anchored to input order.
    best_order: Optional[List[int]] = None
    best_cost = math.inf
    all_nodes = list(range(n))

    for start in all_nodes:
        unvisited = [node for node in all_nodes if node != start]
        current = start
        order = [current]
        path_cost = 0.0

        while unvisited:
            next_node = min(unvisited, key=lambda j: (matrix[current][j], j))
            path_cost += matrix[current][next_node]
            order.append(next_node)
            unvisited.remove(next_node)
            current = next_node

        if (
            path_cost < best_cost
            or (
                math.isclose(path_cost, best_cost, rel_tol=1e-9, abs_tol=1e-9)
                and (best_order is None or tuple(order) < tuple(best_order))
            )
        ):
            best_cost = path_cost
            best_order = order

    return best_order or []


def candidate_orders(order: List[int]) -> List[List[int]]:
    if not order:
        return []
    if len(order) == 1:
        return [order]
    seen: set[tuple[int, ...]] = set()
    out: list[list[int]] = []
    n = len(order)
    reversed_order = list(reversed(order))
    for i in range(n):
        for base in (order, reversed_order):
            rotated = base[i:] + base[:i]
            key = tuple(rotated)
            if key in seen:
                continue
            seen.add(key)
            out.append(rotated)
    return out


def _segment_route_tie_key(segment: Segment, fallback_index: int) -> tuple[str, int]:
    # Segment names generated from planned operations contain stable IDs.
    # Fallback index keeps deterministic behavior for generic segment names.
    return (segment.name, fallback_index)


def _directed_order_tie_key(
    directed_segments: List[DirectedSegment],
    segments: List[Segment],
) -> tuple[tuple[str, int, int], ...]:
    key: list[tuple[str, int, int]] = []
    for directed in directed_segments:
        segment = segments[directed.segment_index]
        segment_key = _segment_route_tie_key(segment, directed.segment_index)
        direction_key = 0 if directed.entry == segment.start else 1
        key.append((segment_key[0], segment_key[1], direction_key))
    return tuple(key)


def best_directions_for_order(
    segments: List[Segment],
    order: List[int],
    start: LatLon,
    end: LatLon,
) -> Tuple[List[DirectedSegment], float]:
    """
    Given a fixed segment order, choose the direction of each segment
    to minimize total distance (start -> segments -> end).
    Dynamic programming on direction choices.

    Each segment can be traversed either:
    - start -> end
    - end -> start
    """
    if not order:
        return [], geodesic_m(start, end)

    directed = []
    for idx in order:
        seg = segments[idx]
        directed.append(
            (
                DirectedSegment(idx, seg.start, seg.end, seg.length_m),
                DirectedSegment(idx, seg.end, seg.start, seg.length_m),
            )
        )

    dp: List[List[Tuple[float, Optional[int]]]] = [
        [(math.inf, None), (math.inf, None)] for _ in range(len(order))
    ]

    for d in (0, 1):
        entry = directed[0][d].entry
        dp[0][d] = (geodesic_m(start, entry) + directed[0][d].traversal_length_m, None)

    for i in range(1, len(order)):
        for d in (0, 1):
            curr_entry = directed[i][d].entry
            curr_len = directed[i][d].traversal_length_m
            best_cost = math.inf
            best_prev: Optional[int] = None
            for pd in (0, 1):
                prev_exit = directed[i - 1][pd].exit
                cost = dp[i - 1][pd][0] + geodesic_m(prev_exit, curr_entry) + curr_len
                if cost < best_cost:
                    best_cost = cost
                    best_prev = pd
            dp[i][d] = (best_cost, best_prev)

    last_idx = len(order) - 1
    total0 = dp[last_idx][0][0] + geodesic_m(directed[last_idx][0].exit, end)
    total1 = dp[last_idx][1][0] + geodesic_m(directed[last_idx][1].exit, end)

    if total0 <= total1:
        best_total = total0
        last_dir = 0
    else:
        best_total = total1
        last_dir = 1

    chosen: List[DirectedSegment] = [directed[last_idx][last_dir]]
    for i in range(last_idx, 0, -1):
        last_dir = dp[i][last_dir][1]  # type: ignore[assignment]
        chosen.append(directed[i - 1][last_dir])
    chosen.reverse()

    return chosen, best_total


def plan_route(
    segments: List[Segment],
    start: LatLon,
    end: LatLon,
) -> Tuple[List[DirectedSegment], float]:
    """
    Full pipeline:
    1) Solve order with TSP heuristic on midpoints (Lin–Kernighan if available)
    2) Choose optimal directions via DP
    """
    if not segments:
        return [], geodesic_m(start, end)

    matrix = build_midpoint_distance_matrix(segments)
    base_order = solve_tsp_order(matrix)
    orders = candidate_orders(base_order)
    if not orders:
        return [], geodesic_m(start, end)

    best_directed: Optional[List[DirectedSegment]] = None
    best_total = math.inf
    best_key: Optional[tuple[tuple[str, int, int], ...]] = None

    for order in orders:
        directed_segments, total_m = best_directions_for_order(segments, order, start, end)
        route_key = _directed_order_tie_key(directed_segments, segments)
        if (
            total_m < best_total
            or (
                math.isclose(total_m, best_total, rel_tol=1e-9, abs_tol=1e-9)
                and (best_key is None or route_key < best_key)
            )
        ):
            best_total = total_m
            best_directed = directed_segments
            best_key = route_key

    return best_directed or [], best_total


def parse_latlon(text: str) -> LatLon:
    lat_s, lon_s = text.split(",", 1)
    return float(lat_s.strip()), float(lon_s.strip())


def _validate_linestring_coordinates(coordinates: Any, operation_id: int) -> List[List[float]]:
    if not isinstance(coordinates, list) or len(coordinates) < 2:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Planned operation {operation_id} must contain at least 2 route coordinates",
        )
    return coordinates


def _segment_from_operation(operation: PlannedOperation) -> Segment:
    route_geometry = operation.route_geometry
    if not isinstance(route_geometry, dict):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Planned operation {operation.id} route geometry is missing",
        )
    if route_geometry.get("type") != "LineString":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Planned operation {operation.id} route geometry must be LineString",
        )
    coordinates = _validate_linestring_coordinates(route_geometry.get("coordinates"), operation.id)
    return segment_from_linestring(coordinates, name=f"planned-operation-{operation.id}")


def optimize_flight_order_routing(
    db: Session,
    *,
    start_site_id: int,
    end_site_id: int,
    planned_operation_ids: list[int],
) -> dict[str, Any]:
    if len(set(planned_operation_ids)) != len(planned_operation_ids):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="planned_operation_ids must contain unique values",
        )

    start_site = db.scalar(select(LandingSite).where(LandingSite.id == start_site_id))
    end_site = db.scalar(select(LandingSite).where(LandingSite.id == end_site_id))
    if start_site is None or end_site is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Landing site not found")

    operations: list[PlannedOperation] = []
    if planned_operation_ids:
        requested_ids = set(planned_operation_ids)
        operation_by_id = {
            operation.id: operation
            for operation in db.scalars(
                select(PlannedOperation).where(PlannedOperation.id.in_(requested_ids))
            )
        }
        missing_ids = [operation_id for operation_id in planned_operation_ids if operation_id not in operation_by_id]
        if missing_ids:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Planned operation not found: {missing_ids}",
            )
        operations = [operation_by_id[operation_id] for operation_id in planned_operation_ids]

    start: LatLon = (start_site.latitude, start_site.longitude)
    end: LatLon = (end_site.latitude, end_site.longitude)
    segments = [_segment_from_operation(operation) for operation in operations]
    ordered_segments, total_distance_m = plan_route(segments=segments, start=start, end=end)

    ordered_operations: list[dict[str, Any]] = []
    for directed in ordered_segments:
        operation = operations[directed.segment_index]
        segment = segments[directed.segment_index]
        direction = "forward" if directed.entry == segment.start else "reverse"
        ordered_operations.append(
            {
                "planned_operation_id": operation.id,
                "direction": direction,
                "entry_point": {
                    "longitude": directed.entry[1],
                    "latitude": directed.entry[0],
                },
                "exit_point": {
                    "longitude": directed.exit[1],
                    "latitude": directed.exit[0],
                },
                "traversal_distance_km": round(directed.traversal_length_m / 1000, 2),
            }
        )

    return {
        "ordered_operations": ordered_operations,
        "total_distance_km": round(total_distance_m / 1000, 2),
    }
