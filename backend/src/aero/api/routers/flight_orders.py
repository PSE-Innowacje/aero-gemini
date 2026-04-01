from typing import cast

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from loguru import logger
from sqlalchemy import select
from sqlalchemy.orm import Session

from aero.api.deps import require_roles
from aero.models.crew_member import CrewMember
from aero.core.database import get_db
from aero.models.enums import FlightOrderStatus, UserRole, WorkflowStatus
from aero.models.flight_order import FlightOrder
from aero.models.user import User
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
    preview_flight_order,
    resolve_pilot_from_logged_user,
    validate_flight_order_status_transition,
    validate_flight_order_reservations,
    validate_flight_order_time_order,
    validate_flight_order_constraints,
    validate_selected_planned_operations,
)

router = APIRouter()


def _mark_operations_as_scheduled(planned_operations: list) -> None:
    for operation in planned_operations:
        if operation.status == WorkflowStatus.APPROVED:
            operation.status = WorkflowStatus.SCHEDULED


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
            "actual_distance": order.actual_distance,
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
    user: User = Depends(require_roles(UserRole.ADMIN, UserRole.PILOT)),
) -> FlightOrderRead:
    validate_flight_order_time_order(
        planned_start=payload.planned_start,
        planned_end=payload.planned_end,
    )
    if user.role == UserRole.PILOT and payload.pilot_id is not None:
        logger.bind(event="flight_order_api", action="create").warning("pilot_id_ignored_in_create_payload")
    if user.role == UserRole.PILOT:
        pilot = resolve_pilot_from_logged_user(db, user)
        pilot_id_for_validation = pilot.id
    else:
        if payload.pilot_id is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="pilot_id is required for ADMIN",
            )
        pilot_id_for_validation = payload.pilot_id
        pilot = db.scalar(select(CrewMember).where(CrewMember.id == pilot_id_for_validation))
        if pilot is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Related entity not found")
    logger.bind(
        event="flight_order_api",
        action="create",
        helicopter_id=payload.helicopter_id,
        pilot_id=pilot_id_for_validation,
        crew_count=len(payload.crew_ids),
    ).info("flight_order_create_started")
    helicopter, pilot, crew, crew_weight = cast(
        tuple,
        validate_flight_order_constraints(
        db=db,
        helicopter_id=payload.helicopter_id,
        pilot_id=pilot_id_for_validation,
        crew_ids=payload.crew_ids,
        estimated_distance=payload.estimated_distance,
        ),
    )
    validate_flight_order_reservations(
        db,
        pilot_id=pilot.id,
        helicopter_id=helicopter.id,
        planned_start=payload.planned_start,
        planned_end=payload.planned_end,
    )
    planned_operations = cast(
        list,
        validate_selected_planned_operations(db, payload.planned_operation_ids),
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
            "actual_distance": None,
            "crew_weight": crew_weight,
            "status": FlightOrderStatus.NEW,
        }
    )
    _mark_operations_as_scheduled(planned_operations)
    assign_relationships(
        order=order,
        pilot=pilot,
        helicopter=helicopter,
        crew=crew,
        planned_operations=planned_operations,
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

    target_status = payload.status if payload.status is not None else order.status
    target_planned_start = payload.planned_start if payload.planned_start is not None else order.planned_start
    target_planned_end = payload.planned_end if payload.planned_end is not None else order.planned_end
    target_actual_start = payload.actual_start if payload.actual_start is not None else order.actual_start
    target_actual_end = payload.actual_end if payload.actual_end is not None else order.actual_end
    validate_flight_order_time_order(
        planned_start=target_planned_start,
        planned_end=target_planned_end,
        actual_start=target_actual_start,
        actual_end=target_actual_end,
    )
    validate_flight_order_status_transition(
        current_status=order.status,
        new_status=target_status,
        actual_start=target_actual_start,
        actual_end=target_actual_end,
    )

    helicopter_id = payload.helicopter_id if payload.helicopter_id is not None else order.helicopter_id
    pilot_id = payload.pilot_id if payload.pilot_id is not None else order.pilot_id
    crew_ids = payload.crew_ids if payload.crew_ids is not None else [member.id for member in order.crew_members]
    estimated_distance = (
        payload.estimated_distance
        if payload.estimated_distance is not None
        else order.estimated_distance
    )
    if any(
        value is not None
        for value in (
            payload.helicopter_id,
            payload.pilot_id,
            payload.crew_ids,
            payload.estimated_distance,
            payload.planned_start,
            payload.planned_end,
        )
    ):
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
        validate_flight_order_reservations(
            db,
            pilot_id=pilot.id,
            helicopter_id=helicopter.id,
            planned_start=target_planned_start,
            planned_end=target_planned_end,
            excluded_order_id=order.id,
        )
        assign_relationships(order=order, pilot=pilot, helicopter=helicopter, crew=crew)
        data["crew_weight"] = crew_weight
        data["estimated_distance"] = estimated_distance

    order = repo.update(order, data)
    if payload.planned_operation_ids is not None:
        order.planned_operations = validate_selected_planned_operations(db, payload.planned_operation_ids)
        _mark_operations_as_scheduled(order.planned_operations)
        db.commit()
        db.refresh(order)
    logger.bind(event="flight_order_api", action="update", order_id=order.id).info("flight_order_update_completed")
    return _to_read(order)


@router.delete("/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_flight_order(
    order_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_roles(UserRole.ADMIN)),
) -> None:
    repo = BaseRepository(db, FlightOrder)
    order = repo.get(order_id)
    if not order:
        logger.bind(event="flight_order_api", action="delete", order_id=order_id).warning(
            "flight_order_delete_not_found"
        )
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Flight order not found")
    db.delete(order)
    db.commit()
    logger.bind(event="flight_order_api", action="delete", order_id=order_id).info("flight_order_delete_completed")
