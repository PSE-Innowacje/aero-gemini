from datetime import date

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from aero.models.crew_member import CrewMember
from aero.models.flight_order import FlightOrder
from aero.models.helicopter import Helicopter


def validate_flight_order_constraints(
    db: Session,
    helicopter_id: int,
    pilot_id: int,
    crew_ids: list[int],
    estimated_distance: float,
) -> tuple[Helicopter, CrewMember, list[CrewMember], int]:
    helicopter = db.get(Helicopter, helicopter_id)
    pilot = db.get(CrewMember, pilot_id)
    crew = [
        member
        for member in (db.get(CrewMember, crew_id) for crew_id in crew_ids)
        if member is not None
    ]

    if not helicopter or not pilot or any(member is None for member in crew):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Related entity not found"
        )

    today = date.today()
    if helicopter.inspection_valid_until and helicopter.inspection_valid_until < today:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Helicopter inspection expired"
        )
    if pilot.license_valid_until and pilot.license_valid_until < today:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Pilot license expired")
    if any(member.training_valid_until < today for member in crew):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Crew training expired")

    crew_weight = int(sum(member.weight for member in crew))
    if crew_weight > helicopter.max_crew_weight:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Crew weight exceeds helicopter limit"
        )
    if estimated_distance > helicopter.range_km:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Estimated distance exceeds range"
        )

    return helicopter, pilot, [member for member in crew if member is not None], crew_weight


def assign_relationships(order: FlightOrder, crew: list[CrewMember]) -> None:
    order.crew_members = crew
