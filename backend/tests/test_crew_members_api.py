"""Automated tests for crew member API endpoints."""

import pytest


def _crew_member_payload(
    email: str = "pilot.one@example.com",
    *,
    role: str = "PILOT",
    pilot_license_number: str | None = "LIC-001",
    license_valid_until: str | None = "2030-01-01",
) -> dict[str, str | int | None]:
    return {
        "first_name": "Pilot",
        "last_name": "One",
        "email": email,
        "weight": 82,
        "role": role,
        "pilot_license_number": pilot_license_number,
        "license_valid_until": license_valid_until,
        "training_valid_until": "2030-01-01",
    }


def test_post_crew_member_success(client, planner_token, authz) -> None:
    response = client.post(
        "/api/crew-members",
        headers=authz(planner_token),
        json=_crew_member_payload(),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["email"] == "pilot.one@example.com"
    assert body["role"] == "PILOT"
    assert body["pilot_license_number"] == "LIC-001"


@pytest.mark.parametrize("token_fixture", ["pilot_user_token"])
def test_post_crew_member_forbidden_for_pilot(client, request, authz, token_fixture: str) -> None:
    token = request.getfixturevalue(token_fixture)
    response = client.post(
        "/api/crew-members",
        headers=authz(token),
        json=_crew_member_payload("forbidden.post@example.com"),
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Forbidden for current role"


def test_post_crew_member_validation_error_for_pilot_without_license(client, planner_token, authz) -> None:
    response = client.post(
        "/api/crew-members",
        headers=authz(planner_token),
        json=_crew_member_payload(
            "pilot.no.license@example.com",
            pilot_license_number=None,
            license_valid_until=None,
        ),
    )

    assert response.status_code == 422


def test_post_crew_member_validation_error_for_pilot_license_too_long(client, planner_token, authz) -> None:
    response = client.post(
        "/api/crew-members",
        headers=authz(planner_token),
        json=_crew_member_payload(
            "pilot.license.too.long@example.com",
            pilot_license_number="L" * 31,
        ),
    )

    assert response.status_code == 422


def test_get_crew_members_success_with_sorting(client, planner_token, authz) -> None:
    first = _crew_member_payload(
        "zulu.observer@example.com",
        role="OBSERVER",
        pilot_license_number=None,
        license_valid_until=None,
    )
    second = _crew_member_payload(
        "alpha.pilot@example.com",
        role="PILOT",
    )
    assert client.post("/api/crew-members", headers=authz(planner_token), json=first).status_code == 200
    assert client.post("/api/crew-members", headers=authz(planner_token), json=second).status_code == 200

    response = client.get(
        "/api/crew-members?sort_by=email&sort_dir=asc&skip=0&limit=50",
        headers=authz(planner_token),
    )

    assert response.status_code == 200
    body = response.json()
    assert len(body) >= 2
    emails = [item["email"] for item in body]
    assert emails == sorted(emails)


def test_get_crew_members_requires_authentication(client) -> None:
    response = client.get("/api/crew-members")
    assert response.status_code == 401


def test_patch_crew_member_success(client, planner_token, authz) -> None:
    created = client.post(
        "/api/crew-members",
        headers=authz(planner_token),
        json=_crew_member_payload("patch.success@example.com"),
    )
    assert created.status_code == 200
    crew_member_id = created.json()["id"]

    response = client.patch(
        f"/api/crew-members/{crew_member_id}",
        headers=authz(planner_token),
        json={"last_name": "Updated", "weight": 88},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == crew_member_id
    assert body["last_name"] == "Updated"
    assert body["weight"] == 88


def test_patch_crew_member_not_found(client, planner_token, authz) -> None:
    response = client.patch(
        "/api/crew-members/9999",
        headers=authz(planner_token),
        json={"last_name": "DoesNotExist"},
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Crew member not found"


def test_patch_crew_member_validation_error_for_invalid_weight(client, planner_token, authz) -> None:
    created = client.post(
        "/api/crew-members",
        headers=authz(planner_token),
        json=_crew_member_payload("patch.validation@example.com"),
    )
    assert created.status_code == 200
    crew_member_id = created.json()["id"]

    response = client.patch(
        f"/api/crew-members/{crew_member_id}",
        headers=authz(planner_token),
        json={"weight": 10},
    )

    assert response.status_code == 422


def test_patch_crew_member_validation_error_when_switching_to_pilot_without_license(client, planner_token, authz) -> None:
    created = client.post(
        "/api/crew-members",
        headers=authz(planner_token),
        json=_crew_member_payload(
            "patch.switch.pilot@example.com",
            role="OBSERVER",
            pilot_license_number=None,
            license_valid_until=None,
        ),
    )
    assert created.status_code == 200
    crew_member_id = created.json()["id"]

    response = client.patch(
        f"/api/crew-members/{crew_member_id}",
        headers=authz(planner_token),
        json={"role": "PILOT"},
    )

    assert response.status_code == 422


def test_patch_crew_member_validation_error_for_pilot_license_too_long(client, planner_token, authz) -> None:
    created = client.post(
        "/api/crew-members",
        headers=authz(planner_token),
        json=_crew_member_payload("patch.license.length@example.com"),
    )
    assert created.status_code == 200
    crew_member_id = created.json()["id"]

    response = client.patch(
        f"/api/crew-members/{crew_member_id}",
        headers=authz(planner_token),
        json={"pilot_license_number": "L" * 31},
    )

    assert response.status_code == 422


def test_patch_crew_member_forbidden_for_pilot(client, planner_token, pilot_user_token, authz) -> None:
    created = client.post(
        "/api/crew-members",
        headers=authz(planner_token),
        json=_crew_member_payload("patch.forbidden@example.com"),
    )
    assert created.status_code == 200
    crew_member_id = created.json()["id"]

    response = client.patch(
        f"/api/crew-members/{crew_member_id}",
        headers=authz(pilot_user_token),
        json={"last_name": "PilotShouldNotEdit"},
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Forbidden for current role"


def test_put_crew_member_not_allowed(client, planner_token, authz) -> None:
    response = client.put(
        "/api/crew-members/1",
        headers=authz(planner_token),
        json=_crew_member_payload("put.not.allowed@example.com"),
    )
    assert response.status_code == 405


def test_delete_crew_member_not_allowed(client, planner_token, authz) -> None:
    response = client.delete("/api/crew-members/1", headers=authz(planner_token))
    assert response.status_code == 405

