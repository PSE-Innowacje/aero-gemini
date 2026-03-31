"""Flight order validations and workflow tests."""

from datetime import date, timedelta

from geopy.distance import geodesic

from aero.models.crew_member import CrewMember
from aero.models.helicopter import Helicopter


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
