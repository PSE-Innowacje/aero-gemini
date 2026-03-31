"""Automated tests for helicopter GET endpoints."""


def _create_helicopter(client, token: str, authz, registration_number: str, helicopter_type: str = "EC145") -> None:
    response = client.post(
        "/api/helicopters",
        headers=authz(token),
        json={
            "registration_number": registration_number,
            "type": helicopter_type,
            "description": f"helicopter {registration_number}",
            "max_crew": 4,
            "max_crew_weight": 350,
            "status": "active",
            "inspection_valid_until": "2030-01-01",
            "range_km": 220,
        },
    )
    assert response.status_code == 200


def test_get_helicopters_visible_for_authorized_roles(client, planner_token, admin_token, supervisor_token, pilot_user_token, authz) -> None:
    _create_helicopter(client, planner_token, authz, "SP-GET1", "AW109")
    _create_helicopter(client, planner_token, authz, "SP-GET2", "EC135")

    for token in (admin_token, planner_token, supervisor_token, pilot_user_token):
        response = client.get("/api/helicopters", headers=authz(token))
        assert response.status_code == 200
        body = response.json()
        assert len(body) >= 2
        assert all("registration_number" in item for item in body)


def test_get_helicopters_requires_authentication(client) -> None:
    response = client.get("/api/helicopters")

    assert response.status_code == 401
    assert response.json()["detail"] == "Not authenticated"


def test_get_helicopters_supports_sorting(client, planner_token, admin_token, authz) -> None:
    _create_helicopter(client, planner_token, authz, "SP-SORT-A", "A")
    _create_helicopter(client, planner_token, authz, "SP-SORT-B", "B")

    response = client.get("/api/helicopters?sort_by=type&sort_dir=desc", headers=authz(admin_token))

    assert response.status_code == 200
    body = response.json()
    types = [item["type"] for item in body]
    assert "A" in types and "B" in types
    assert types.index("B") < types.index("A")


def test_get_helicopters_supports_pagination(client, planner_token, admin_token, authz) -> None:
    _create_helicopter(client, planner_token, authz, "SP-PAGE1", "Type-1")
    _create_helicopter(client, planner_token, authz, "SP-PAGE2", "Type-2")
    _create_helicopter(client, planner_token, authz, "SP-PAGE3", "Type-3")

    response = client.get("/api/helicopters?sort_by=registration_number&sort_dir=asc&skip=1&limit=1", headers=authz(admin_token))

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["registration_number"] == "SP-PAGE2"


def test_get_helicopters_rejects_invalid_sort_dir(client, admin_token, authz) -> None:
    response = client.get("/api/helicopters?sort_dir=sideways", headers=authz(admin_token))

    assert response.status_code == 422
