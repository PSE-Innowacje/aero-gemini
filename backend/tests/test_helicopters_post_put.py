"""Automated tests for helicopter POST and PUT endpoints."""


def _helicopter_payload(
    registration_number: str = "SP-POST1",
    *,
    status: str = "active",
    inspection_valid_until: str | None = "2030-01-01",
) -> dict[str, str | int | None]:
    return {
        "registration_number": registration_number,
        "type": "EC145",
        "description": "test helicopter",
        "max_crew": 4,
        "max_crew_weight": 350,
        "status": status,
        "inspection_valid_until": inspection_valid_until,
        "range_km": 220,
    }


def test_post_helicopter_success(client, planner_token, authz) -> None:
    response = client.post("/api/helicopters", headers=authz(planner_token), json=_helicopter_payload())

    assert response.status_code == 200
    body = response.json()
    assert body["registration_number"] == "SP-POST1"
    assert body["status"] == "active"


def test_post_helicopter_validation_error_when_active_without_inspection(client, planner_token, authz) -> None:
    payload = _helicopter_payload("SP-POST2", inspection_valid_until=None)
    response = client.post("/api/helicopters", headers=authz(planner_token), json=payload)

    assert response.status_code == 422


def test_post_helicopter_validation_error_when_description_too_long(client, planner_token, authz) -> None:
    payload = _helicopter_payload("SP-POST-DESC-LONG")
    payload["description"] = "x" * 101
    response = client.post("/api/helicopters", headers=authz(planner_token), json=payload)

    assert response.status_code == 422


def test_post_helicopter_duplicate_registration_returns_conflict(client, planner_token, authz) -> None:
    first = client.post("/api/helicopters", headers=authz(planner_token), json=_helicopter_payload("SP-DUP-POST"))
    second = client.post("/api/helicopters", headers=authz(planner_token), json=_helicopter_payload("SP-DUP-POST"))

    assert first.status_code == 200
    assert second.status_code == 409
    assert second.json()["detail"] == "Registration number already exists"


def test_put_helicopter_success_full_replace(client, planner_token, authz) -> None:
    created = client.post("/api/helicopters", headers=authz(planner_token), json=_helicopter_payload("SP-PUT1"))
    assert created.status_code == 200
    helicopter_id = created.json()["id"]

    put_payload = {
        "registration_number": "SP-PUT1-NEW",
        "type": "AW109",
        "description": "fully replaced",
        "max_crew": 5,
        "max_crew_weight": 420,
        "status": "inactive",
        "inspection_valid_until": None,
        "range_km": 300,
    }
    updated = client.put(f"/api/helicopters/{helicopter_id}", headers=authz(planner_token), json=put_payload)

    assert updated.status_code == 200
    body = updated.json()
    assert body["registration_number"] == "SP-PUT1-NEW"
    assert body["type"] == "AW109"
    assert body["status"] == "inactive"
    assert body["inspection_valid_until"] is None
    assert body["range_km"] == 300


def test_put_helicopter_validation_error_for_invalid_max_crew(client, planner_token, authz) -> None:
    created = client.post("/api/helicopters", headers=authz(planner_token), json=_helicopter_payload("SP-PUT2"))
    assert created.status_code == 200
    helicopter_id = created.json()["id"]

    payload = _helicopter_payload("SP-PUT2")
    payload["max_crew"] = 0
    response = client.put(f"/api/helicopters/{helicopter_id}", headers=authz(planner_token), json=payload)

    assert response.status_code == 422


def test_patch_helicopter_requires_inspection_when_status_set_to_active(client, planner_token, authz) -> None:
    created = client.post(
        "/api/helicopters",
        headers=authz(planner_token),
        json=_helicopter_payload("SP-PATCH1", status="inactive", inspection_valid_until=None),
    )
    assert created.status_code == 200
    helicopter_id = created.json()["id"]

    response = client.patch(
        f"/api/helicopters/{helicopter_id}",
        headers=authz(planner_token),
        json={"status": "active", "inspection_valid_until": None},
    )

    assert response.status_code == 422
    assert response.json()["detail"] == "inspection_valid_until is required when helicopter is active"


def test_put_helicopter_not_found(client, planner_token, authz) -> None:
    response = client.put("/api/helicopters/9999", headers=authz(planner_token), json=_helicopter_payload("SP-PUT3"))

    assert response.status_code == 404
    assert response.json()["detail"] == "Helicopter not found"


def test_put_helicopter_duplicate_registration_returns_conflict(client, planner_token, authz) -> None:
    first = client.post("/api/helicopters", headers=authz(planner_token), json=_helicopter_payload("SP-DUP-PUT1"))
    second = client.post("/api/helicopters", headers=authz(planner_token), json=_helicopter_payload("SP-DUP-PUT2"))
    assert first.status_code == 200
    assert second.status_code == 200

    first_id = first.json()["id"]
    response = client.put(
        f"/api/helicopters/{first_id}",
        headers=authz(planner_token),
        json=_helicopter_payload("SP-DUP-PUT2"),
    )

    assert response.status_code == 409
    assert response.json()["detail"] == "Registration number already exists"


def test_put_helicopter_forbidden_for_pilot(client, planner_token, pilot_user_token, authz) -> None:
    created = client.post("/api/helicopters", headers=authz(planner_token), json=_helicopter_payload("SP-PUT4"))
    assert created.status_code == 200
    helicopter_id = created.json()["id"]

    response = client.put(
        f"/api/helicopters/{helicopter_id}",
        headers=authz(pilot_user_token),
        json=_helicopter_payload("SP-PUT4-NEW"),
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Forbidden for current role"
