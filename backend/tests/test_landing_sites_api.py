"""Automated tests for landing site API endpoints."""


def _landing_site_payload(
    name: str = "Site Alpha",
    *,
    latitude: float = 52.2297,
    longitude: float = 21.0122,
) -> dict[str, str | float]:
    return {"name": name, "latitude": latitude, "longitude": longitude}


def test_post_landing_site_success(client, planner_token, authz) -> None:
    response = client.post(
        "/api/landing-sites",
        headers=authz(planner_token),
        json=_landing_site_payload("Site POST"),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Site POST"
    assert body["latitude"] == 52.2297
    assert body["longitude"] == 21.0122


def test_post_landing_site_forbidden_for_pilot(client, pilot_user_token, authz) -> None:
    response = client.post(
        "/api/landing-sites",
        headers=authz(pilot_user_token),
        json=_landing_site_payload("Site Forbidden"),
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Forbidden for current role"


def test_post_landing_site_validation_error_for_invalid_latitude(client, planner_token, authz) -> None:
    response = client.post(
        "/api/landing-sites",
        headers=authz(planner_token),
        json=_landing_site_payload("Site Invalid", latitude=100.0),
    )
    assert response.status_code == 422


def test_get_landing_sites_success_with_sorting(client, planner_token, authz) -> None:
    assert (
        client.post(
            "/api/landing-sites",
            headers=authz(planner_token),
            json=_landing_site_payload("Zulu Site"),
        ).status_code
        == 200
    )
    assert (
        client.post(
            "/api/landing-sites",
            headers=authz(planner_token),
            json=_landing_site_payload("Alpha Site"),
        ).status_code
        == 200
    )

    response = client.get(
        "/api/landing-sites?sort_by=name&sort_dir=asc&skip=0&limit=50",
        headers=authz(planner_token),
    )
    assert response.status_code == 200
    body = response.json()
    names = [item["name"] for item in body]
    assert names == sorted(names)


def test_get_landing_sites_requires_authentication(client) -> None:
    response = client.get("/api/landing-sites")
    assert response.status_code == 401


def test_patch_landing_site_success(client, planner_token, authz) -> None:
    created = client.post(
        "/api/landing-sites",
        headers=authz(planner_token),
        json=_landing_site_payload("Patch Site"),
    )
    assert created.status_code == 200
    site_id = created.json()["id"]

    response = client.patch(
        f"/api/landing-sites/{site_id}",
        headers=authz(planner_token),
        json={"name": "Patch Site Updated", "latitude": 50.0},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == site_id
    assert body["name"] == "Patch Site Updated"
    assert body["latitude"] == 50.0


def test_patch_landing_site_not_found(client, planner_token, authz) -> None:
    response = client.patch(
        "/api/landing-sites/9999",
        headers=authz(planner_token),
        json={"name": "Does Not Exist"},
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Landing site not found"


def test_patch_landing_site_forbidden_for_supervisor(client, planner_token, supervisor_token, authz) -> None:
    created = client.post(
        "/api/landing-sites",
        headers=authz(planner_token),
        json=_landing_site_payload("No Supervisor Edit"),
    )
    assert created.status_code == 200
    site_id = created.json()["id"]

    response = client.patch(
        f"/api/landing-sites/{site_id}",
        headers=authz(supervisor_token),
        json={"name": "Supervisor Update Attempt"},
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Forbidden for current role"


def test_patch_landing_site_validation_error_for_invalid_longitude(client, planner_token, authz) -> None:
    created = client.post(
        "/api/landing-sites",
        headers=authz(planner_token),
        json=_landing_site_payload("Longitude Validation"),
    )
    assert created.status_code == 200
    site_id = created.json()["id"]

    response = client.patch(
        f"/api/landing-sites/{site_id}",
        headers=authz(planner_token),
        json={"longitude": -181.0},
    )
    assert response.status_code == 422


def test_put_landing_site_not_allowed(client, planner_token, authz) -> None:
    response = client.put(
        "/api/landing-sites/1",
        headers=authz(planner_token),
        json=_landing_site_payload("PUT Not Allowed"),
    )
    assert response.status_code == 405


def test_delete_landing_site_not_allowed(client, planner_token, authz) -> None:
    response = client.delete("/api/landing-sites/1", headers=authz(planner_token))
    assert response.status_code == 405
