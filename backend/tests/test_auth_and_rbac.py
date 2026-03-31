"""Auth and RBAC endpoint tests."""


def test_register_and_login_success(client) -> None:
    register_response = client.post(
        "/api/auth/register",
        json={
            "first_name": "Alice",
            "last_name": "Admin",
            "email": "alice@example.com",
            "password": "secret123",
            "role": "ADMIN",
        },
    )
    assert register_response.status_code == 200
    assert register_response.json()["email"] == "alice@example.com"

    login_response = client.post(
        "/api/auth/login",
        json={"email": "alice@example.com", "password": "secret123"},
    )
    assert login_response.status_code == 200
    body = login_response.json()
    assert body["token_type"] == "bearer"
    assert body["role"] == "ADMIN"
    assert body["access_token"]


def test_register_duplicate_email_rejected(client) -> None:
    payload = {
        "first_name": "Bob",
        "last_name": "User",
        "email": "dup@example.com",
        "password": "secret123",
        "role": "PLANNER",
    }
    first = client.post("/api/auth/register", json=payload)
    second = client.post("/api/auth/register", json=payload)
    assert first.status_code == 200
    assert second.status_code == 409
    assert second.json()["detail"] == "Email already exists"


def test_rbac_prevents_pilot_from_creating_helicopter(client, pilot_user_token, authz) -> None:
    response = client.post(
        "/api/helicopters",
        headers=authz(pilot_user_token),
        json={
            "registration_number": "SP-RBAC1",
            "type": "EC135",
            "description": "rbac test",
            "max_crew": 4,
            "max_crew_weight": 400,
            "status": "active",
            "inspection_valid_until": "2030-01-01",
            "range_km": 300,
        },
    )
    assert response.status_code == 403
    assert response.json()["detail"] == "Forbidden for current role"


def test_planner_can_create_helicopter(client, planner_token, authz) -> None:
    response = client.post(
        "/api/helicopters",
        headers=authz(planner_token),
        json={
            "registration_number": "SP-PLAN1",
            "type": "EC145",
            "description": "planner create",
            "max_crew": 4,
            "max_crew_weight": 350,
            "status": "active",
            "inspection_valid_until": "2030-01-01",
            "range_km": 220,
        },
    )
    assert response.status_code == 200
    assert response.json()["registration_number"] == "SP-PLAN1"
