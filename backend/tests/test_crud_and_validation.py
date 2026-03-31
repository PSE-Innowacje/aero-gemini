"""CRUD and validation tests for core entities."""


def test_helicopter_active_requires_inspection_date(client, planner_token, authz) -> None:
    response = client.post(
        "/api/helicopters",
        headers=authz(planner_token),
        json={
            "registration_number": "SP-VAL1",
            "type": "H125",
            "description": "missing inspection",
            "max_crew": 4,
            "max_crew_weight": 320,
            "status": "active",
            "range_km": 150,
        },
    )
    assert response.status_code == 422


def test_pilot_crew_member_requires_license_fields(client, planner_token, authz) -> None:
    response = client.post(
        "/api/crew-members",
        headers=authz(planner_token),
        json={
            "first_name": "Pilot",
            "last_name": "NoLicense",
            "email": "pilot-nolicense@example.com",
            "weight": 90,
            "role": "PILOT",
            "training_valid_until": "2030-01-01",
        },
    )
    assert response.status_code == 422


def test_landing_site_coordinates_are_validated(client, planner_token, authz) -> None:
    response = client.post(
        "/api/landing-sites",
        headers=authz(planner_token),
        json={"name": "Invalid Site", "latitude": 120.0, "longitude": 21.0},
    )
    assert response.status_code == 422


def test_helicopter_list_supports_sorting_and_pagination(client, planner_token, admin_token, authz) -> None:
    first = {
        "registration_number": "SP-SORT1",
        "type": "A",
        "description": "a",
        "max_crew": 4,
        "max_crew_weight": 300,
        "status": "active",
        "inspection_valid_until": "2030-01-01",
        "range_km": 100,
    }
    second = {
        "registration_number": "SP-SORT2",
        "type": "B",
        "description": "b",
        "max_crew": 4,
        "max_crew_weight": 300,
        "status": "active",
        "inspection_valid_until": "2030-01-01",
        "range_km": 100,
    }
    assert client.post("/api/helicopters", headers=authz(planner_token), json=first).status_code == 200
    assert client.post("/api/helicopters", headers=authz(planner_token), json=second).status_code == 200

    response = client.get("/api/helicopters?sort_by=id&sort_dir=desc&skip=0&limit=1", headers=authz(admin_token))
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["registration_number"] == "SP-SORT2"
