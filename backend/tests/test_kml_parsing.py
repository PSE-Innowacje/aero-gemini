"""Unit tests for KML distance parsing."""

from itertools import pairwise
from pathlib import Path

import pytest
from geopy.distance import geodesic

from aero.services.planned_operations import parse_kml_distance


def test_parse_kml_distance_returns_zero_for_none_path() -> None:
    assert parse_kml_distance(None) == 0.0


def test_parse_kml_distance_returns_zero_for_missing_file(tmp_path: Path) -> None:
    missing = tmp_path / "missing.kml"
    assert parse_kml_distance(str(missing)) == 0.0


def test_parse_kml_distance_returns_zero_for_malformed_kml(tmp_path: Path) -> None:
    malformed = tmp_path / "broken.kml"
    malformed.write_text("<kml><Document><Placemark></kml>", encoding="utf-8")
    assert parse_kml_distance(str(malformed)) == 0.0


def test_parse_kml_distance_reads_linestrings_from_nested_features(tmp_path: Path) -> None:
    # Coordinates are written as lon,lat[,alt], while distance expects (lat, lon).
    route_points: list[tuple[float, float]] = [
        (37.0000, -122.0000),
        (37.1000, -122.1000),
        (37.2500, -122.0500),
        (37.3500, -121.9500),
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
    kml_path = tmp_path / "route.kml"
    kml_path.write_text(kml_content, encoding="utf-8")

    expected = round(sum(geodesic(a, b).kilometers for a, b in pairwise(route_points)), 2)
    result = parse_kml_distance(str(kml_path))

    assert result == pytest.approx(expected, abs=0.01)
