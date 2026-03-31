from fastapi import APIRouter, Depends, HTTPException, Query, status
from loguru import logger
from sqlalchemy.orm import Session

from aero.api.deps import require_roles
from aero.core.database import get_db
from aero.models.enums import UserRole
from aero.models.flight_order import FlightOrder
from aero.repositories.base import BaseRepository
from aero.schemas.flight_order import FlightOrderCreate, FlightOrderRead, FlightOrderUpdate
from aero.services.flight_orders import (
    assign_relationships,
    get_planned_operations,
    validate_flight_order_constraints,
)

router = APIRouter()


@router.post("", response_model=FlightOrderRead)
def create_flight_order(
    payload: FlightOrderCreate,
    db: Session = Depends(get_db),
    _=Depends(require_roles(UserRole.ADMIN, UserRole.PLANNER, UserRole.SUPERVISOR)),
) -> FlightOrderRead:
    logger.bind(
        event="flight_order_api",
        action="create",
        helicopter_id=payload.helicopter_id,
        pilot_id=payload.pilot_id,
        crew_count=len(payload.crew_ids),
    ).info("flight_order_create_started")
    helicopter, pilot, crew, crew_weight = validate_flight_order_constraints(
        db=db,
        helicopter_id=payload.helicopter_id,
        pilot_id=payload.pilot_id,
        crew_ids=payload.crew_ids,
        estimated_distance=payload.estimated_distance,
    )
    repo = BaseRepository(db, FlightOrder)
    order = repo.create(
        {
            "planned_start": payload.planned_start,
            "planned_end": payload.planned_end,
            "pilot_id": pilot.id,
            "helicopter_id": helicopter.id,
            "start_site_id": payload.start_site_id,
            "end_site_id": payload.end_site_id,
            "estimated_distance": payload.estimated_distance,
            "crew_weight": crew_weight,
        }
    )
    assign_relationships(
        order=order,
        pilot=pilot,
        helicopter=helicopter,
        crew=crew,
        planned_operations=get_planned_operations(db, payload.planned_operation_ids or []),
    )
    db.commit()
    db.refresh(order)
    logger.bind(event="flight_order_api", action="create", order_id=order.id).info("flight_order_create_completed")
    return FlightOrderRead.model_validate(order)


@router.get("", response_model=list[FlightOrderRead])
def list_flight_orders(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    _=Depends(require_roles(UserRole.ADMIN, UserRole.PLANNER, UserRole.SUPERVISOR, UserRole.PILOT)),
) -> list[FlightOrderRead]:
    repo = BaseRepository(db, FlightOrder)
    items = [FlightOrderRead.model_validate(item) for item in repo.list(skip=skip, limit=limit)]
    logger.bind(
        event="flight_order_api",
        action="list",
        skip=skip,
        limit=limit,
        result_count=len(items),
    ).debug("flight_order_list_completed")
    return items


@router.patch("/{order_id}", response_model=FlightOrderRead)
def update_flight_order(
    order_id: int,
    payload: FlightOrderUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_roles(UserRole.ADMIN, UserRole.PILOT, UserRole.SUPERVISOR)),
) -> FlightOrderRead:
    repo = BaseRepository(db, FlightOrder)
    order = repo.get(order_id)
    if not order:
        logger.bind(event="flight_order_api", action="update", order_id=order_id).warning(
            "flight_order_update_not_found"
        )
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Flight order not found")

    data = payload.model_dump(exclude_unset=True, exclude={"planned_operation_ids"})
    order = repo.update(order, data)
    if payload.planned_operation_ids is not None:
        order.planned_operations = get_planned_operations(db, payload.planned_operation_ids)
        db.commit()
        db.refresh(order)
    logger.bind(event="flight_order_api", action="update", order_id=order.id).info("flight_order_update_completed")
    return FlightOrderRead.model_validate(order)
