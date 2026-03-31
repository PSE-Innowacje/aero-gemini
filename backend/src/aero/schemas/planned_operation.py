from datetime import date, datetime
from typing import Any, Literal

from pydantic import EmailStr, Field, computed_field, field_validator, model_validator

from aero.models.enums import WorkflowStatus
from aero.schemas.common import ORMModel


class RoutePoint(ORMModel):
    longitude: float
    latitude: float


class RouteGeometry(ORMModel):
    type: Literal["LineString"]
    coordinates: list[tuple[float, float]]


ALLOWED_ACTIVITY_NAMES = {
    "ogledziny_wizualne",
    "skan_3d",
    "lokalizacja_awarii",
    "zdjecia",
    "patrolowanie",
}


class PlannedOperationCommentRead(ORMModel):
    content: str
    created_at: datetime
    author_email: EmailStr


class PlannedOperationHistoryEntry(ORMModel):
    changed_at: datetime
    actor_email: EmailStr
    action: str
    before_snapshot: dict[str, Any] | None = None
    after_snapshot: dict[str, Any] | None = None


class PlannedOperationCreate(ORMModel):
    project_code: str = Field(min_length=1, max_length=30)
    short_description: str = Field(min_length=1, max_length=100)
    route_geometry: RouteGeometry | None = None
    kml_content: str | bytes | None = None
    proposed_date_from: date | None = None
    proposed_date_to: date | None = None
    planned_date_from: date | None = None
    planned_date_to: date | None = None
    activities: list[str]
    extra_info: str | None = Field(default=None, max_length=500)
    contacts: list[EmailStr] | None = None

    @model_validator(mode="after")
    def validate_route_source(self) -> "PlannedOperationCreate":
        if not self.route_geometry and not self.kml_content:
            raise ValueError("Provide either route_geometry or kml_content")
        if self.route_geometry and self.kml_content:
            raise ValueError("Provide only one route source: route_geometry or kml_content")
        if self.proposed_date_from and self.proposed_date_to and self.proposed_date_from > self.proposed_date_to:
            raise ValueError("proposed_date_from cannot be later than proposed_date_to")
        if self.planned_date_from and self.planned_date_to and self.planned_date_from > self.planned_date_to:
            raise ValueError("planned_date_from cannot be later than planned_date_to")
        return self

    @field_validator("activities")
    @classmethod
    def validate_activities(cls, value: list[str]) -> list[str]:
        if not value:
            raise ValueError("At least one activity is required")
        normalized = [activity.strip().lower() for activity in value]
        if len(set(normalized)) != len(normalized):
            raise ValueError("Activities must be unique")
        invalid = [activity for activity in normalized if activity not in ALLOWED_ACTIVITY_NAMES]
        if invalid:
            raise ValueError(f"Unsupported activities: {', '.join(invalid)}")
        return normalized


class PlannedOperationUpdate(ORMModel):
    project_code: str | None = Field(default=None, min_length=1, max_length=30)
    short_description: str | None = Field(default=None, min_length=1, max_length=100)
    route_geometry: RouteGeometry | None = None
    kml_content: str | bytes | None = None
    proposed_date_from: date | None = None
    proposed_date_to: date | None = None
    planned_date_from: date | None = None
    planned_date_to: date | None = None
    activities: list[str] | None = None
    extra_info: str | None = Field(default=None, max_length=500)
    contacts: list[EmailStr] | None = None
    post_realization_notes: str | None = Field(default=None, max_length=500)
    comment: str | None = Field(default=None, max_length=500)

    @model_validator(mode="after")
    def validate_route_source(self) -> "PlannedOperationUpdate":
        if self.route_geometry and self.kml_content:
            raise ValueError("Provide only one route source: route_geometry or kml_content")
        if self.proposed_date_from and self.proposed_date_to and self.proposed_date_from > self.proposed_date_to:
            raise ValueError("proposed_date_from cannot be later than proposed_date_to")
        if self.planned_date_from and self.planned_date_to and self.planned_date_from > self.planned_date_to:
            raise ValueError("planned_date_from cannot be later than planned_date_to")
        return self

    @field_validator("activities")
    @classmethod
    def validate_activities(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return None
        if not value:
            raise ValueError("At least one activity is required")
        normalized = [activity.strip().lower() for activity in value]
        if len(set(normalized)) != len(normalized):
            raise ValueError("Activities must be unique")
        invalid = [activity for activity in normalized if activity not in ALLOWED_ACTIVITY_NAMES]
        if invalid:
            raise ValueError(f"Unsupported activities: {', '.join(invalid)}")
        return normalized


class PlannedOperationStatusUpdate(ORMModel):
    status: WorkflowStatus


class PlannedOperationRead(ORMModel):
    id: int
    project_code: str
    short_description: str
    route_geometry: RouteGeometry | None = None
    route_bbox: list[float] | None = None
    points_count: int
    proposed_date_from: date | None = None
    proposed_date_to: date | None = None
    planned_date_from: date | None = None
    planned_date_to: date | None = None
    activities: list[str]
    extra_info: str | None = None
    distance_km: int
    status: WorkflowStatus
    created_by: int
    created_by_email: EmailStr
    contacts: list[EmailStr] = Field(default_factory=list)
    comments: list[PlannedOperationCommentRead] = Field(default_factory=list)
    history: list[PlannedOperationHistoryEntry] = Field(default_factory=list)
    post_realization_notes: str | None = None
    linked_flight_order_ids: list[int] = Field(default_factory=list)

    @computed_field
    @property
    def start_point(self) -> RoutePoint | None:
        if not self.route_geometry or not self.route_geometry.coordinates:
            return None
        lon, lat = self.route_geometry.coordinates[0]
        return RoutePoint(longitude=lon, latitude=lat)

    @computed_field
    @property
    def end_point(self) -> RoutePoint | None:
        if not self.route_geometry or not self.route_geometry.coordinates:
            return None
        lon, lat = self.route_geometry.coordinates[-1]
        return RoutePoint(longitude=lon, latitude=lat)
