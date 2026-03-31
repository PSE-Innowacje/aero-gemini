"""Planned operation workflow and audit tests."""

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
            "kml_file_path": None,
            "proposed_date_from": str(date.today() + timedelta(days=1)),
            "proposed_date_to": str(date.today() + timedelta(days=2)),
            "activities": [{"name": "survey"}],
            "contacts": ["ops@example.com"],
        },
    )
    assert response.status_code == 200
    return response.json()


def test_create_planned_operation_and_audit_entry(client, planner_token, authz, db_session) -> None:
    created = _create_operation(client, planner_token, authz, "PRJ-AUDIT")
    assert created["project_code"] == "PRJ-AUDIT"
    assert created["status"] == 1

    audit_rows = list(
        db_session.scalars(
            select(PlannedOperationAudit).where(PlannedOperationAudit.planned_operation_id == created["id"])
        )
    )
    assert len(audit_rows) == 1
    assert audit_rows[0].action == "create"


def test_status_transition_requires_supervisor_role(client, planner_token, authz) -> None:
    created = _create_operation(client, planner_token, authz, "PRJ-ROLE")
    response = client.post(
        f"/api/planned-operations/{created['id']}/status",
        headers=authz(planner_token),
        json={"status": 2},
    )
    assert response.status_code == 403
    assert response.json()["detail"] == "Supervisor role required"


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
    assert items[0]["id"] != first["id"]


def test_create_planned_operation_forbidden_for_pilot(client, pilot_user_token, authz) -> None:
    response = client.post(
        "/api/planned-operations",
        headers=authz(pilot_user_token),
        json={
            "project_code": "PRJ-PILOT",
            "short_description": "Pilot cannot create",
            "kml_file_path": None,
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
