"""Flight order validations and workflow tests."""

from datetime import date, timedelta

from geopy.distance import geodesic

from aero.models.crew_member import CrewMember
from aero.models.helicopter import Helicopter
from aero.models.planned_operation import PlannedOperation


def _create_flight_order(client, token: str, authz, ids: dict[str, int], estimated_distance: float = 100.0):
    return client.post(
        "/api/flight-orders",
        headers=authz(token),
        json={
            "pilot_id": ids["pilot_id"],
            "helicopter_id": ids["helicopter_id"],
            "crew_ids": [ids["pilot_id"], ids["observer_id"]],
            "start_site_id": ids["site_a_id"],
            "end_site_id": ids["site_b_id"],
            "planned_operation_ids": [],
            "estimated_distance": estimated_distance,
        },
    )


def _create_planned_operation(client, token: str, authz, project_code: str, coordinates: list[list[float]]) -> int:
    response = client.post(
        "/api/planned-operations",
        headers=authz(token),
        json={
            "project_code": project_code,
            "short_description": f"Operation {project_code}",
            "route_geometry": {
                "type": "LineString",
                "coordinates": coordinates,
            },
        },
    )
    assert response.status_code == 200
    return response.json()["id"]


def test_create_flight_order_computes_crew_weight(client, planner_token, authz, operational_entities) -> None:
    response = _create_flight_order(client, planner_token, authz, operational_entities, estimated_distance=120.0)
    assert response.status_code == 200
    body = response.json()
    assert body["crew_weight"] == 150
    assert body["estimated_distance"] == 120.0


def test_reject_when_helicopter_inspection_expired(
    client, db_session, planner_token, authz, operational_entities
) -> None:
    helicopter = db_session.get(Helicopter, operational_entities["helicopter_id"])
    assert helicopter is not None
    helicopter.inspection_valid_until = date.today() - timedelta(days=1)
    db_session.commit()

    response = _create_flight_order(client, planner_token, authz, operational_entities)
    assert response.status_code == 400
    assert response.json()["detail"] == "Helicopter inspection expired"


def test_reject_when_pilot_license_expired(client, db_session, planner_token, authz, operational_entities) -> None:
    pilot = db_session.get(CrewMember, operational_entities["pilot_id"])
    assert pilot is not None
    pilot.license_valid_until = date.today() - timedelta(days=1)
    db_session.commit()

    response = _create_flight_order(client, planner_token, authz, operational_entities)
    assert response.status_code == 400
    assert response.json()["detail"] == "Pilot license expired"


def test_reject_when_crew_training_expired(client, db_session, planner_token, authz, operational_entities) -> None:
    observer = db_session.get(CrewMember, operational_entities["observer_id"])
    assert observer is not None
    observer.training_valid_until = date.today() - timedelta(days=1)
    db_session.commit()

    response = _create_flight_order(client, planner_token, authz, operational_entities)
    assert response.status_code == 400
    assert response.json()["detail"] == "Crew training expired"


def test_reject_when_crew_weight_exceeds_limit(client, db_session, planner_token, authz, operational_entities) -> None:
    helicopter = db_session.get(Helicopter, operational_entities["helicopter_id"])
    assert helicopter is not None
    helicopter.max_crew_weight = 120
    db_session.commit()

    response = _create_flight_order(client, planner_token, authz, operational_entities)
    assert response.status_code == 400
    assert response.json()["detail"] == "Crew weight exceeds helicopter limit"


def test_reject_when_estimated_distance_exceeds_range(
    client, db_session, planner_token, authz, operational_entities
) -> None:
    helicopter = db_session.get(Helicopter, operational_entities["helicopter_id"])
    assert helicopter is not None
    helicopter.range_km = 50
    db_session.commit()

    response = _create_flight_order(client, planner_token, authz, operational_entities, estimated_distance=75.0)
    assert response.status_code == 400
    assert response.json()["detail"] == "Estimated distance exceeds range"


def test_estimate_flight_order_distance_matches_geodesic(client, planner_token, authz, operational_entities) -> None:
    ids = operational_entities
    expected = round(geodesic((52.1, 21.0), (52.2, 21.1)).kilometers, 2)
    response = client.post(
        "/api/flight-orders/estimate-distance",
        headers=authz(planner_token),
        json={
            "start_site_id": ids["site_a_id"],
            "end_site_id": ids["site_b_id"],
            "planned_operation_ids": [],
        },
    )
    assert response.status_code == 200
    assert response.json()["distance_km"] == expected


def test_optimize_route_returns_order_direction_and_total_distance(
    client, planner_token, authz, operational_entities
) -> None:
    ids = operational_entities
    op1_id = _create_planned_operation(
        client,
        planner_token,
        authz,
        "PRJ-ROUTE-1",
        [[21.01, 52.11], [21.04, 52.13], [21.06, 52.14]],
    )
    op2_id = _create_planned_operation(
        client,
        planner_token,
        authz,
        "PRJ-ROUTE-2",
        [[21.08, 52.16], [21.10, 52.18], [21.12, 52.19]],
    )

    response = client.post(
        "/api/flight-orders/optimize-route",
        headers=authz(planner_token),
        json={
            "start_site_id": ids["site_a_id"],
            "end_site_id": ids["site_b_id"],
            "planned_operation_ids": [op1_id, op2_id],
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert len(body["ordered_operations"]) == 2
    assert {item["planned_operation_id"] for item in body["ordered_operations"]} == {op1_id, op2_id}
    assert all(item["direction"] in {"forward", "reverse"} for item in body["ordered_operations"])
    assert all(item["traversal_distance_km"] > 0 for item in body["ordered_operations"])
    assert body["total_distance_km"] > 0


def test_preview_route_returns_distance_range_and_blocking_info(
    client, planner_token, authz, operational_entities
) -> None:
    ids = operational_entities
    op1_id = _create_planned_operation(
        client,
        planner_token,
        authz,
        "PRJ-PREVIEW-1",
        [[21.01, 52.11], [21.04, 52.13], [21.06, 52.14]],
    )
    op2_id = _create_planned_operation(
        client,
        planner_token,
        authz,
        "PRJ-PREVIEW-2",
        [[21.08, 52.16], [21.10, 52.18], [21.12, 52.19]],
    )
    response = client.post(
        "/api/flight-orders/preview",
        headers=authz(planner_token),
        json={
            "start_site_id": ids["site_a_id"],
            "end_site_id": ids["site_b_id"],
            "helicopter_id": ids["helicopter_id"],
            "planned_operation_ids": [op1_id, op2_id],
            "strategy": "optimized",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert len(body["ordered_operations"]) == 2
    assert body["total_distance_km"] > 0
    assert isinstance(body["within_helicopter_range"], bool)
    assert "range_margin_km" in body
    assert body["blocking_reasons"] == []


def test_preview_route_blocks_when_distance_exceeds_helicopter_range(
    client, db_session, planner_token, authz, operational_entities
) -> None:
    ids = operational_entities
    helicopter = db_session.get(Helicopter, ids["helicopter_id"])
    assert helicopter is not None
    helicopter.range_km = 1
    db_session.commit()

    response = client.post(
        "/api/flight-orders/preview",
        headers=authz(planner_token),
        json={
            "start_site_id": ids["site_a_id"],
            "end_site_id": ids["site_b_id"],
            "helicopter_id": ids["helicopter_id"],
            "planned_operation_ids": [],
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["within_helicopter_range"] is False
    assert body["blocking_reasons"] == ["RANGE_EXCEEDED"]
    assert body["range_margin_km"] < 0


def test_preview_and_create_order_are_consistent(
    client, planner_token, authz, operational_entities
) -> None:
    ids = operational_entities
    op1_id = _create_planned_operation(
        client,
        planner_token,
        authz,
        "PRJ-PREVIEW-CREATE-1",
        [[21.01, 52.11], [21.04, 52.13], [21.06, 52.14]],
    )
    op2_id = _create_planned_operation(
        client,
        planner_token,
        authz,
        "PRJ-PREVIEW-CREATE-2",
        [[21.08, 52.16], [21.10, 52.18], [21.12, 52.19]],
    )
    preview_response = client.post(
        "/api/flight-orders/preview",
        headers=authz(planner_token),
        json={
            "start_site_id": ids["site_a_id"],
            "end_site_id": ids["site_b_id"],
            "helicopter_id": ids["helicopter_id"],
            "planned_operation_ids": [op1_id, op2_id],
            "strategy": "optimized",
        },
    )
    assert preview_response.status_code == 200
    preview = preview_response.json()
    ordered_operation_ids = [item["planned_operation_id"] for item in preview["ordered_operations"]]

    create_response = client.post(
        "/api/flight-orders",
        headers=authz(planner_token),
        json={
            "pilot_id": ids["pilot_id"],
            "helicopter_id": ids["helicopter_id"],
            "crew_ids": [ids["pilot_id"], ids["observer_id"]],
            "start_site_id": ids["site_a_id"],
            "end_site_id": ids["site_b_id"],
            "planned_operation_ids": ordered_operation_ids,
            "estimated_distance": preview["total_distance_km"],
        },
    )
    assert create_response.status_code == 200
    body = create_response.json()
    assert body["estimated_distance"] == preview["total_distance_km"]
    assert set(body["planned_operation_ids"]) == set(ordered_operation_ids)


def test_optimize_route_returns_direct_distance_for_empty_operations(
    client, planner_token, authz, operational_entities
) -> None:
    ids = operational_entities
    expected = round(geodesic((52.1, 21.0), (52.2, 21.1)).kilometers, 2)
    response = client.post(
        "/api/flight-orders/optimize-route",
        headers=authz(planner_token),
        json={
            "start_site_id": ids["site_a_id"],
            "end_site_id": ids["site_b_id"],
            "planned_operation_ids": [],
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["ordered_operations"] == []
    assert body["total_distance_km"] == expected


def test_optimize_route_returns_404_for_missing_landing_site(
    client, planner_token, authz, operational_entities
) -> None:
    ids = operational_entities
    response = client.post(
        "/api/flight-orders/optimize-route",
        headers=authz(planner_token),
        json={
            "start_site_id": 999999,
            "end_site_id": ids["site_b_id"],
            "planned_operation_ids": [],
        },
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "Landing site not found"


def test_optimize_route_returns_404_for_missing_planned_operation(
    client, planner_token, authz, operational_entities
) -> None:
    ids = operational_entities
    response = client.post(
        "/api/flight-orders/optimize-route",
        headers=authz(planner_token),
        json={
            "start_site_id": ids["site_a_id"],
            "end_site_id": ids["site_b_id"],
            "planned_operation_ids": [999999],
        },
    )
    assert response.status_code == 404
    assert "Planned operation not found" in response.json()["detail"]


def test_optimize_route_returns_422_for_non_linestring_operation(
    client, db_session, planner_token, authz, operational_entities
) -> None:
    ids = operational_entities
    operation_id = _create_planned_operation(
        client,
        planner_token,
        authz,
        "PRJ-INVALID-ROUTE",
        [[21.01, 52.11], [21.03, 52.12]],
    )
    operation = db_session.get(PlannedOperation, operation_id)
    assert operation is not None
    operation.route_geometry = {"type": "Point", "coordinates": [21.01, 52.11]}
    db_session.commit()

    response = client.post(
        "/api/flight-orders/optimize-route",
        headers=authz(planner_token),
        json={
            "start_site_id": ids["site_a_id"],
            "end_site_id": ids["site_b_id"],
            "planned_operation_ids": [operation_id],
        },
    )
    assert response.status_code == 422
    assert "route geometry must be LineString" in response.json()["detail"]


def test_optimize_route_rejects_duplicate_operation_ids(client, planner_token, authz, operational_entities) -> None:
    ids = operational_entities
    operation_id = _create_planned_operation(
        client,
        planner_token,
        authz,
        "PRJ-DUPLICATE-ID",
        [[21.02, 52.11], [21.05, 52.13]],
    )
    response = client.post(
        "/api/flight-orders/optimize-route",
        headers=authz(planner_token),
        json={
            "start_site_id": ids["site_a_id"],
            "end_site_id": ids["site_b_id"],
            "planned_operation_ids": [operation_id, operation_id],
        },
    )
    assert response.status_code == 422
    assert response.json()["detail"] == "planned_operation_ids must contain unique values"


def test_preview_route_rejects_duplicate_operation_ids(client, planner_token, authz, operational_entities) -> None:
    ids = operational_entities
    operation_id = _create_planned_operation(
        client,
        planner_token,
        authz,
        "PRJ-PREVIEW-DUPLICATE-ID",
        [[21.02, 52.11], [21.05, 52.13]],
    )
    response = client.post(
        "/api/flight-orders/preview",
        headers=authz(planner_token),
        json={
            "start_site_id": ids["site_a_id"],
            "end_site_id": ids["site_b_id"],
            "helicopter_id": ids["helicopter_id"],
            "planned_operation_ids": [operation_id, operation_id],
        },
    )
    assert response.status_code == 422
    assert response.json()["detail"] == "planned_operation_ids must contain unique values"


def test_optimize_route_requires_authentication(client, operational_entities) -> None:
    ids = operational_entities
    response = client.post(
        "/api/flight-orders/optimize-route",
        json={
            "start_site_id": ids["site_a_id"],
            "end_site_id": ids["site_b_id"],
            "planned_operation_ids": [],
        },
    )
    assert response.status_code == 401
