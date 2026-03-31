"""Automated tests for users API endpoints."""

import pytest


def _register_user(client, *, email: str, role: str = "PLANNER") -> None:
    response = client.post(
        "/api/auth/register",
        json={
            "first_name": "User",
            "last_name": "Fixture",
            "email": email,
            "password": "secret123",
            "role": role,
        },
    )
    assert response.status_code == 200


@pytest.mark.parametrize("token_fixture", ["admin_token", "supervisor_token"])
def test_get_users_success_for_allowed_roles(client, request, authz, token_fixture: str) -> None:
    _register_user(client, email="list-user.one@example.com")
    _register_user(client, email="list-user.two@example.com")
    token = request.getfixturevalue(token_fixture)

    response = client.get(
        "/api/users?sort_by=email&sort_dir=asc&skip=0&limit=50",
        headers=authz(token),
    )

    assert response.status_code == 200
    body = response.json()
    assert len(body) >= 2
    emails = [item["email"] for item in body]
    assert emails == sorted(emails)


def test_get_users_forbidden_for_planner(client, planner_token, authz) -> None:
    response = client.get("/api/users", headers=authz(planner_token))
    assert response.status_code == 403
    assert response.json()["detail"] == "Forbidden for current role"


def test_get_users_requires_authentication(client) -> None:
    response = client.get("/api/users")
    assert response.status_code == 401


def test_patch_user_success_for_admin(client, admin_token, authz) -> None:
    _register_user(client, email="patch-user@example.com", role="PILOT")
    listed = client.get("/api/users?sort_by=id&sort_dir=desc&limit=1", headers=authz(admin_token))
    assert listed.status_code == 200
    user_id = listed.json()[0]["id"]

    response = client.patch(
        f"/api/users/{user_id}",
        headers=authz(admin_token),
        json={"first_name": "Updated", "role": "SUPERVISOR"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == user_id
    assert body["first_name"] == "Updated"
    assert body["role"] == "SUPERVISOR"


def test_patch_user_not_found(client, admin_token, authz) -> None:
    response = client.patch(
        "/api/users/9999",
        headers=authz(admin_token),
        json={"first_name": "Missing"},
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "User not found"


def test_patch_user_forbidden_for_supervisor(client, supervisor_token, authz) -> None:
    response = client.patch(
        "/api/users/1",
        headers=authz(supervisor_token),
        json={"first_name": "NoAccess"},
    )
    assert response.status_code == 403
    assert response.json()["detail"] == "Forbidden for current role"


def test_patch_user_validation_error_for_invalid_role(client, admin_token, authz) -> None:
    _register_user(client, email="patch-invalid-role@example.com", role="PLANNER")
    listed = client.get("/api/users?sort_by=id&sort_dir=desc&limit=1", headers=authz(admin_token))
    assert listed.status_code == 200
    user_id = listed.json()[0]["id"]

    response = client.patch(
        f"/api/users/{user_id}",
        headers=authz(admin_token),
        json={"role": "NOT_A_ROLE"},
    )
    assert response.status_code == 422


def test_post_users_not_allowed(client, admin_token, authz) -> None:
    response = client.post(
        "/api/users",
        headers=authz(admin_token),
        json={"first_name": "A", "last_name": "B", "role": "ADMIN"},
    )
    assert response.status_code == 405


def test_put_users_not_allowed(client, admin_token, authz) -> None:
    response = client.put(
        "/api/users/1",
        headers=authz(admin_token),
        json={"first_name": "A", "last_name": "B", "role": "ADMIN"},
    )
    assert response.status_code == 405


def test_delete_users_not_allowed(client, admin_token, authz) -> None:
    response = client.delete("/api/users/1", headers=authz(admin_token))
    assert response.status_code == 405
