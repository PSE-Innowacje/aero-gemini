"""Unit tests for route normalization and KML parsing."""

from itertools import pairwise

import pytest
from fastapi import HTTPException
from geopy.distance import geodesic

from aero.services.planned_operations import normalize_route, parse_kml_coordinates, route_start_end


def test_normalize_route_rejects_missing_input() -> None:
    with pytest.raises(HTTPException) as exc_info:
        normalize_route(None, None)
    assert exc_info.value.status_code == 422


def test_parse_kml_coordinates_rejects_malformed_content() -> None:
    with pytest.raises(HTTPException) as exc_info:
        parse_kml_coordinates("<kml><Document><Placemark></kml>")
    assert exc_info.value.status_code == 422


def test_normalize_route_reads_linestrings_from_nested_features() -> None:
    # Coordinates are written as lon,lat[,alt], while distance expects (lat, lon).
    route_points_lat_lon: list[tuple[float, float]] = [
        (37.0, -122.0),
        (37.1, -122.1),
        (37.25, -122.05),
        (37.35, -121.95),
    ]
    kml_content = """<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Folder>
      <Placemark>
        <LineString>
          <coordinates>-122.0000,37.0000,0 -122.1000,37.1000,0</coordinates>
        </LineString>
      </Placemark>
      <Placemark>
        <LineString>
          <coordinates>-122.0500,37.2500,0 -121.9500,37.3500,0</coordinates>
        </LineString>
      </Placemark>
    </Folder>
  </Document>
</kml>
"""
    expected = round(sum(geodesic(a, b).kilometers for a, b in pairwise(route_points_lat_lon)), 2)
    result = normalize_route(None, kml_content)

    assert result["distance_km"] == pytest.approx(expected, abs=0.01)
    assert result["points_count"] == 4
    assert result["route_geometry"]["type"] == "LineString"
    assert result["route_bbox"] == [-122.1, 37.0, -121.95, 37.35]


def test_route_start_end_is_computed_from_geometry() -> None:
    route_geometry = {
        "type": "LineString",
        "coordinates": [[21.0, 52.1], [21.1, 52.2], [21.3, 52.4]],
    }
    start_point, end_point = route_start_end(route_geometry)
    assert start_point == {"longitude": 21.0, "latitude": 52.1}
    assert end_point == {"longitude": 21.3, "latitude": 52.4}
