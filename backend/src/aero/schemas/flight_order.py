from datetime import datetime

from aero.models.enums import WorkflowStatus
from aero.schemas.common import ORMModel


class FlightOrderCreate(ORMModel):
    planned_start: datetime | None = None
    planned_end: datetime | None = None
    pilot_id: int
    helicopter_id: int
    crew_ids: list[int]
    start_site_id: int
    end_site_id: int
    planned_operation_ids: list[int] | None = None
    estimated_distance: float


class FlightOrderUpdate(ORMModel):
    planned_start: datetime | None = None
    planned_end: datetime | None = None
    actual_start: datetime | None = None
    actual_end: datetime | None = None
    pilot_id: int | None = None
    helicopter_id: int | None = None
    crew_ids: list[int] | None = None
    start_site_id: int | None = None
    end_site_id: int | None = None
    estimated_distance: float | None = None
    status: WorkflowStatus | None = None
    planned_operation_ids: list[int] | None = None


class FlightOrderRead(ORMModel):
    id: int
    planned_start: datetime | None = None
    planned_end: datetime | None = None
    actual_start: datetime | None = None
    actual_end: datetime | None = None
    pilot_id: int
    helicopter_id: int
    crew_ids: list[int]
    start_site_id: int
    end_site_id: int
    planned_operation_ids: list[int]
    crew_weight: int
    estimated_distance: float
    status: WorkflowStatus


class FlightOrderDistanceEstimateRequest(ORMModel):
    start_site_id: int
    end_site_id: int
    planned_operation_ids: list[int] | None = None


class FlightOrderDistanceEstimateResponse(ORMModel):
    distance_km: float
