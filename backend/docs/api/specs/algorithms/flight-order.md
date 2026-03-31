# Helicopter Route Planning (Segment TSP → ATSP)

## Goal
Design an algorithm that computes the order of route segments defined in GeoJSON so that the helicopter:
- takes off from a given start airport,
- visits all routes,
- lands at a given end airport (optionally the same).

The algorithm must return:
- the ordered list of routes,
- the total travel distance.

## Problem Context
This is a variant of Segment TSP. The preferred approach is to transform it into an ATSP instance and solve it with a Lin–Kernighan heuristic. Implementation in Python, with minimal custom logic and maximum use of existing libraries.

## Input
- `start_airport`: identifier or coordinates of the start airport
- `end_airport`: identifier or coordinates of the end airport
- `geojson_routes[]`: list of GeoJSON objects or files, each defining a `LineString` (or `MultiLineString`) route segment

## Output
- `ordered_routes[]`: list of routes in execution order
- `total_distance`: total travel distance
- `path_trace` (optional): point-by-point flight path

## Assumptions
- Each GeoJSON `LineString` defines a segment (route) with fixed geometry.
- The helicopter enters a segment only at its endpoints (either endpoint is allowed).
- Each segment must be fully traversed.
- Distances are computed geodesically on WGS84.

## Proposed Approach
1. Parse GeoJSON into segments (with endpoints).
2. Transform Segment TSP → ATSP:
   - Each segment has two directed endpoints (entry/exit).
   - Transition cost depends on chosen direction.
3. Solve ATSP using Lin–Kernighan heuristic (via library).
4. Reconstruct segment order and compute total distance.

## Preferred Libraries
- GeoJSON parsing: built-in `json`
- Geodesic distance: `geopy`
- ATSP / TSP heuristics:
  - `python-tsp` (if ATSP supported)
  - `elkai` (LK heuristic)
  - `lkh` (Python bindings if feasible)

## Quality Requirements
- Minimize custom algorithmic logic.
- Maximize use of established libraries.
- Code must be modular and testable.

## Acceptance Criteria
- Returns a valid ordered list of segments and total distance.
- Works for different start/end airports.
- Operates on realistic GeoJSON datasets.
- Logs runtime and helpful metrics.

## Logging
- INFO: start/end of algorithm, number of segments, total distance
- DEBUG: cost matrix, chosen order, timing breakdown
- Do not log sensitive data