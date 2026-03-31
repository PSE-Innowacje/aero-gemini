from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, List, Tuple, Optional, Dict, Any
import argparse
import json
import math

from geopy.distance import geodesic

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

    # Fallback: nearest-neighbor
    unvisited = set(range(n))
    current = 0
    order = [current]
    unvisited.remove(current)
    while unvisited:
        next_node = min(unvisited, key=lambda j: matrix[current][j])
        order.append(next_node)
        unvisited.remove(next_node)
        current = next_node
    return order


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
    order = solve_tsp_order(matrix)
    directed_segments, total_m = best_directions_for_order(segments, order, start, end)
    return directed_segments, total_m


def parse_latlon(text: str) -> LatLon:
    lat_s, lon_s = text.split(",", 1)
    return float(lat_s.strip()), float(lon_s.strip())
