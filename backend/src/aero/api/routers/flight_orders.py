from typing import cast

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from loguru import logger
from sqlalchemy.orm import Session

from aero.api.deps import require_roles
from aero.core.database import get_db
from aero.models.enums import UserRole
from aero.models.flight_order import FlightOrder
from aero.repositories.base import BaseRepository
from aero.schemas.flight_order import (
    FlightOrderCreate,
    FlightOrderDistanceEstimateRequest,
    FlightOrderDistanceEstimateResponse,
    FlightOrderPreviewRequest,
    FlightOrderPreviewResponse,
    FlightOrderRead,
    FlightOrderRoutingRequest,
    FlightOrderRoutingResponse,
    FlightOrderUpdate,
)
from aero.services.flight_order_routing import optimize_flight_order_routing
from aero.services.flight_orders import (
    assign_relationships,
    estimate_flight_order_distance_km,
    get_planned_operations,
    preview_flight_order,
    validate_flight_order_constraints,
)

router = APIRouter()


def _to_read(order: FlightOrder) -> FlightOrderRead:
    return FlightOrderRead.model_validate(
        {
            "id": order.id,
            "planned_start": order.planned_start,
            "planned_end": order.planned_end,
            "actual_start": order.actual_start,
            "actual_end": order.actual_end,
            "pilot_id": order.pilot_id,
            "helicopter_id": order.helicopter_id,
            "crew_ids": [member.id for member in order.crew_members],
            "start_site_id": order.start_site_id,
            "end_site_id": order.end_site_id,
            "planned_operation_ids": [operation.id for operation in order.planned_operations],
            "crew_weight": order.crew_weight,
            "estimated_distance": order.estimated_distance,
            "status": order.status,
        }
    )


@router.post("/estimate-distance", response_model=FlightOrderDistanceEstimateResponse)
def estimate_flight_order_route_distance(
    payload: FlightOrderDistanceEstimateRequest,
    db: Session = Depends(get_db),
    _=Depends(require_roles(UserRole.ADMIN, UserRole.PLANNER, UserRole.SUPERVISOR, UserRole.PILOT)),
) -> FlightOrderDistanceEstimateResponse:
    distance_km = estimate_flight_order_distance_km(
        db,
        start_site_id=payload.start_site_id,
        end_site_id=payload.end_site_id,
        planned_operation_ids=payload.planned_operation_ids,
    )
    return FlightOrderDistanceEstimateResponse(distance_km=distance_km)


@router.post("/preview", response_model=FlightOrderPreviewResponse)
def preview_flight_order_route(
    payload: FlightOrderPreviewRequest,
    db: Session = Depends(get_db),
    _=Depends(require_roles(UserRole.ADMIN, UserRole.PLANNER, UserRole.SUPERVISOR, UserRole.PILOT)),
) -> FlightOrderPreviewResponse:
    result = preview_flight_order(
        db,
        start_site_id=payload.start_site_id,
        end_site_id=payload.end_site_id,
        helicopter_id=payload.helicopter_id,
        planned_operation_ids=payload.planned_operation_ids,
        strategy=payload.strategy,
    )
    return FlightOrderPreviewResponse.model_validate(result)


@router.post(
    "/optimize-route",
    response_model=FlightOrderRoutingResponse,
    summary="Optimize route for planned operations",
    description=(
        "Calculates optimized order and direction for planned operations between "
        "start and end landing sites, and returns total route distance."
    ),
    responses={
        200: {
            "description": "Optimized route details",
            "content": {
                "application/json": {
                    "example": {
                        "ordered_operations": [
                            {
                                "planned_operation_id": 101,
                                "direction": "forward",
                                "entry_point": {"longitude": 21.01, "latitude": 52.11},
                                "exit_point": {"longitude": 21.06, "latitude": 52.14},
                                "traversal_distance_km": 4.62,
                            },
                            {
                                "planned_operation_id": 102,
                                "direction": "reverse",
                                "entry_point": {"longitude": 21.12, "latitude": 52.19},
                                "exit_point": {"longitude": 21.08, "latitude": 52.16},
                                "traversal_distance_km": 3.77,
                            },
                        ],
                        "total_distance_km": 23.45,
                    }
                }
            },
        }
    },
)
def optimize_flight_order_route(
    payload: FlightOrderRoutingRequest = Body(
        examples=[
            {
                "start_site_id": 1,
                "end_site_id": 2,
                "planned_operation_ids": [101, 102, 103],
            }
        ]
    ),
    db: Session = Depends(get_db),
    _=Depends(require_roles(UserRole.ADMIN, UserRole.PLANNER, UserRole.SUPERVISOR, UserRole.PILOT)),
) -> FlightOrderRoutingResponse:
    result = optimize_flight_order_routing(
        db,
        start_site_id=payload.start_site_id,
        end_site_id=payload.end_site_id,
        planned_operation_ids=payload.planned_operation_ids,
    )
    return FlightOrderRoutingResponse.model_validate(result)


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
    helicopter, pilot, crew, crew_weight = cast(
        tuple,
        validate_flight_order_constraints(
        db=db,
        helicopter_id=payload.helicopter_id,
        pilot_id=payload.pilot_id,
        crew_ids=payload.crew_ids,
        estimated_distance=payload.estimated_distance,
        ),
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
        planned_operations=cast(list, get_planned_operations(db, payload.planned_operation_ids or [])),
    )
    db.commit()
    db.refresh(order)
    logger.bind(event="flight_order_api", action="create", order_id=order.id).info("flight_order_create_completed")
    return _to_read(order)


@router.get("", response_model=list[FlightOrderRead])
def list_flight_orders(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    _=Depends(require_roles(UserRole.ADMIN, UserRole.PLANNER, UserRole.SUPERVISOR, UserRole.PILOT)),
) -> list[FlightOrderRead]:
    repo = BaseRepository(db, FlightOrder)
    items = [_to_read(item) for item in repo.list(skip=skip, limit=limit)]
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
    _=Depends(require_roles(UserRole.ADMIN, UserRole.PILOT, UserRole.PLANNER, UserRole.SUPERVISOR)),
) -> FlightOrderRead:
    repo = BaseRepository(db, FlightOrder)
    order = repo.get(order_id)
    if not order:
        logger.bind(event="flight_order_api", action="update", order_id=order_id).warning(
            "flight_order_update_not_found"
        )
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Flight order not found")

    data = payload.model_dump(exclude_unset=True, exclude={"planned_operation_ids", "crew_ids"})

    if any(
        value is not None
        for value in (
            payload.helicopter_id,
            payload.pilot_id,
            payload.crew_ids,
            payload.estimated_distance,
        )
    ):
        helicopter_id = payload.helicopter_id if payload.helicopter_id is not None else order.helicopter_id
        pilot_id = payload.pilot_id if payload.pilot_id is not None else order.pilot_id
        crew_ids = payload.crew_ids if payload.crew_ids is not None else [member.id for member in order.crew_members]
        estimated_distance = (
            payload.estimated_distance
            if payload.estimated_distance is not None
            else order.estimated_distance
        )
        helicopter, pilot, crew, crew_weight = cast(
            tuple,
            validate_flight_order_constraints(
            db=db,
            helicopter_id=helicopter_id,
            pilot_id=pilot_id,
            crew_ids=crew_ids,
            estimated_distance=estimated_distance,
            ),
        )
        assign_relationships(order=order, pilot=pilot, helicopter=helicopter, crew=crew)
        data["crew_weight"] = crew_weight
        data["estimated_distance"] = estimated_distance

    order = repo.update(order, data)
    if payload.planned_operation_ids is not None:
        order.planned_operations = get_planned_operations(db, payload.planned_operation_ids)
        db.commit()
        db.refresh(order)
    logger.bind(event="flight_order_api", action="update", order_id=order.id).info("flight_order_update_completed")
    return _to_read(order)
