from datetime import datetime
from typing import Literal

from pydantic import Field, model_validator

from aero.models.enums import FlightOrderStatus
from aero.schemas.common import ORMModel


class FlightOrderCreate(ORMModel):
    planned_start: datetime
    planned_end: datetime
    pilot_id: int | None = None
    helicopter_id: int
    crew_ids: list[int] = Field(default_factory=list)
    start_site_id: int
    end_site_id: int
    planned_operation_ids: list[int] = Field(min_length=1)
    estimated_distance: float

    @model_validator(mode="after")
    def validate_planned_time_order(self) -> "FlightOrderCreate":
        if self.planned_end <= self.planned_start:
            raise ValueError("planned_end must be later than planned_start")
        return self


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
    actual_distance: float | None = None
    status: FlightOrderStatus | None = None
    planned_operation_ids: list[int] | None = None
    performed_operation_ids: list[int] | None = None

    @model_validator(mode="after")
    def validate_time_order_for_provided_pairs(self) -> "FlightOrderUpdate":
        if (
            self.planned_start is not None
            and self.planned_end is not None
            and self.planned_end <= self.planned_start
        ):
            raise ValueError("planned_end must be later than planned_start")
        if (
            self.actual_start is not None
            and self.actual_end is not None
            and self.actual_end <= self.actual_start
        ):
            raise ValueError("actual_end must be later than actual_start")
        return self


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
    actual_distance: float | None = None
    status: FlightOrderStatus


class FlightOrderDistanceEstimateRequest(ORMModel):
    start_site_id: int
    end_site_id: int
    planned_operation_ids: list[int] | None = None


class FlightOrderDistanceEstimateResponse(ORMModel):
    distance_km: float


class FlightOrderRoutingRequest(ORMModel):
    start_site_id: int
    end_site_id: int
    planned_operation_ids: list[int]


class FlightOrderRoutingPoint(ORMModel):
    longitude: float
    latitude: float


class FlightOrderRoutingOperation(ORMModel):
    planned_operation_id: int
    direction: Literal["forward", "reverse"]
    entry_point: FlightOrderRoutingPoint
    exit_point: FlightOrderRoutingPoint
    traversal_distance_km: float


class FlightOrderRoutingResponse(ORMModel):
    ordered_operations: list[FlightOrderRoutingOperation]
    total_distance_km: float


class FlightOrderPreviewRequest(ORMModel):
    start_site_id: int
    end_site_id: int
    helicopter_id: int
    planned_operation_ids: list[int]
    strategy: Literal["optimized", "input_order"] = "optimized"


class FlightOrderPreviewResponse(ORMModel):
    ordered_operations: list[FlightOrderRoutingOperation]
    total_distance_km: float
    within_helicopter_range: bool
    range_margin_km: float
    blocking_reasons: list[str]
    cache_hit: bool = False
