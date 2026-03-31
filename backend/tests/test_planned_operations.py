"""Planned operation workflow and audit tests."""

import json
from datetime import date, timedelta

from sqlalchemy import select

from aero.models.audit import PlannedOperationAudit


def _create_operation(client, token: str, authz, project_code: str = "PRJ-T1") -> dict:
    response = client.post(
        "/api/planned-operations",
        headers=authz(token),
        json={
            "project_code": project_code,
            "short_description": "Test operation",
            "route_geometry": {
                "type": "LineString",
                "coordinates": [
                    [21.0, 52.1],
                    [21.1, 52.2],
                    [21.2, 52.25],
                ],
            },
            "proposed_date_from": str(date.today() + timedelta(days=1)),
            "proposed_date_to": str(date.today() + timedelta(days=2)),
            "activities": ["ogledziny_wizualne"],
            "contacts": ["ops@example.com"],
        },
    )
    assert response.status_code == 200
    return response.json()


def test_create_planned_operation_and_audit_entry(client, planner_token, authz, db_session) -> None:
    created = _create_operation(client, planner_token, authz, "PRJ-AUDIT")
    assert created["project_code"] == "PRJ-AUDIT"
    assert created["status"] == 1
    assert created["start_point"] == {"longitude": 21.0, "latitude": 52.1}
    assert created["end_point"] == {"longitude": 21.2, "latitude": 52.25}

    audit_rows = list(
        db_session.scalars(
            select(PlannedOperationAudit).where(PlannedOperationAudit.planned_operation_id == created["id"])
        )
    )
    assert len(audit_rows) == 1
    assert audit_rows[0].action == "create"


def test_create_planned_operation_with_kml_upload(client, planner_token, authz) -> None:
    kml_content = """<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Placemark>
      <LineString>
        <coordinates>21.0000,52.1000,0 21.1000,52.2000,0 21.2000,52.2500,0</coordinates>
      </LineString>
    </Placemark>
  </Document>
</kml>
"""
    payload_json = json.dumps(
        {
            "project_code": "PRJ-KML-UPLOAD",
            "short_description": "Operation created from KML upload",
            "proposed_date_from": str(date.today() + timedelta(days=1)),
            "proposed_date_to": str(date.today() + timedelta(days=2)),
            "activities": ["ogledziny_wizualne"],
            "contacts": ["ops@example.com"],
        }
    )
    response = client.post(
        "/api/planned-operations/upload-kml",
        headers=authz(planner_token),
        data={"payload_json": payload_json},
        files={
            "kml_file": (
                "route.kml",
                kml_content,
                "application/vnd.google-earth.kml+xml",
            )
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["project_code"] == "PRJ-KML-UPLOAD"
    assert body["points_count"] == 3
    assert body["start_point"] == {"longitude": 21.0, "latitude": 52.1}
    assert body["end_point"] == {"longitude": 21.2, "latitude": 52.25}
    assert body["distance_km"] > 0


def test_create_planned_operation_with_utf16_kml_upload(client, planner_token, authz) -> None:
    kml_content_utf16 = """<?xml version="1.0" encoding="UTF-16"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Placemark>
      <LineString>
        <coordinates>17.0000,51.1000,0 17.0500,51.1200,0 17.1000,51.1500,0</coordinates>
      </LineString>
    </Placemark>
  </Document>
</kml>
""".encode("utf-16")
    payload_json = json.dumps(
        {
            "project_code": "PRJ-KML-UTF16",
            "short_description": "Operation created from UTF-16 KML upload",
            "activities": ["ogledziny_wizualne"],
        }
    )
    response = client.post(
        "/api/planned-operations/upload-kml",
        headers=authz(planner_token),
        data={"payload_json": payload_json},
        files={
            "kml_file": (
                "route_utf16.kml",
                kml_content_utf16,
                "application/vnd.google-earth.kml+xml",
            )
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["project_code"] == "PRJ-KML-UTF16"
    assert body["points_count"] == 3
    assert body["distance_km"] > 0


def test_status_transition_requires_supervisor_role(client, planner_token, authz) -> None:
    created = _create_operation(client, planner_token, authz, "PRJ-ROLE")
    response = client.post(
        f"/api/planned-operations/{created['id']}/status",
        headers=authz(planner_token),
        json={"status": 2},
    )
    assert response.status_code == 403
    assert response.json()["detail"] == "Planner cannot perform this status transition"


def test_status_transition_valid_for_supervisor(client, planner_token, supervisor_token, authz) -> None:
    created = _create_operation(client, planner_token, authz, "PRJ-TRANS")
    response = client.post(
        f"/api/planned-operations/{created['id']}/status",
        headers=authz(supervisor_token),
        json={"status": 2},
    )
    assert response.status_code == 200
    assert response.json()["status"] == 2


def test_invalid_status_transition_is_rejected(client, planner_token, supervisor_token, authz) -> None:
    created = _create_operation(client, planner_token, authz, "PRJ-BADTRANS")
    first = client.post(
        f"/api/planned-operations/{created['id']}/status",
        headers=authz(supervisor_token),
        json={"status": 2},
    )
    assert first.status_code == 200
    second = client.post(
        f"/api/planned-operations/{created['id']}/status",
        headers=authz(supervisor_token),
        json={"status": 6},
    )
    assert second.status_code == 400
    assert second.json()["detail"] == "Invalid status transition"


def test_planned_operations_status_filter(client, planner_token, supervisor_token, pilot_user_token, authz) -> None:
    first = _create_operation(client, planner_token, authz, "PRJ-FLT1")
    second = _create_operation(client, planner_token, authz, "PRJ-FLT2")
    status_change = client.post(
        f"/api/planned-operations/{second['id']}/status",
        headers=authz(supervisor_token),
        json={"status": 2},
    )
    assert status_change.status_code == 200

    filtered = client.get("/api/planned-operations?status_filter=2", headers=authz(pilot_user_token))
    assert filtered.status_code == 200
    items = filtered.json()
    assert len(items) == 1
    assert items[0]["id"] == second["id"]
    assert items[0]["status"] == 2
    assert items[0]["start_point"] == {"longitude": 21.0, "latitude": 52.1}
    assert items[0]["end_point"] == {"longitude": 21.2, "latitude": 52.25}
    assert items[0]["id"] != first["id"]


def test_create_planned_operation_forbidden_for_pilot(client, pilot_user_token, authz) -> None:
    response = client.post(
        "/api/planned-operations",
        headers=authz(pilot_user_token),
        json={
            "project_code": "PRJ-PILOT",
            "short_description": "Pilot cannot create",
            "route_geometry": {
                "type": "LineString",
                "coordinates": [
                    [21.0, 52.1],
                    [21.1, 52.2],
                ],
            },
        },
    )
    assert response.status_code == 403
    assert response.json()["detail"] == "Forbidden for current role"


def test_get_planned_operations_requires_authentication(client) -> None:
    response = client.get("/api/planned-operations")
    assert response.status_code == 401


def test_get_planned_operations_validation_error_for_invalid_status_filter(client, planner_token, authz) -> None:
    response = client.get("/api/planned-operations?status_filter=9", headers=authz(planner_token))
    assert response.status_code == 422


def test_patch_planned_operation_success(client, planner_token, authz) -> None:
    created = _create_operation(client, planner_token, authz, "PRJ-PATCH")
    response = client.patch(
        f"/api/planned-operations/{created['id']}",
        headers=authz(planner_token),
        json={"short_description": "Updated description", "extra_info": "Updated"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["id"] == created["id"]
    assert body["short_description"] == "Updated description"


def test_patch_planned_operation_not_found(client, planner_token, authz) -> None:
    response = client.patch(
        "/api/planned-operations/9999",
        headers=authz(planner_token),
        json={"short_description": "Missing"},
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "Planned operation not found"


def test_patch_planned_operation_forbidden_for_pilot(client, planner_token, pilot_user_token, authz) -> None:
    created = _create_operation(client, planner_token, authz, "PRJ-FORBID")
    response = client.patch(
        f"/api/planned-operations/{created['id']}",
        headers=authz(pilot_user_token),
        json={"short_description": "Pilot update attempt"},
    )
    assert response.status_code == 403
    assert response.json()["detail"] == "Forbidden for current role"


def test_change_operation_status_not_found(client, supervisor_token, authz) -> None:
    response = client.post(
        "/api/planned-operations/9999/status",
        headers=authz(supervisor_token),
        json={"status": 2},
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "Planned operation not found"


def test_put_planned_operation_not_allowed(client, planner_token, authz) -> None:
    response = client.put(
        "/api/planned-operations/1",
        headers=authz(planner_token),
        json={"project_code": "PRJ-PUT"},
    )
    assert response.status_code == 405


def test_delete_planned_operation_not_allowed(client, planner_token, authz) -> None:
    response = client.delete("/api/planned-operations/1", headers=authz(planner_token))
    assert response.status_code == 405
