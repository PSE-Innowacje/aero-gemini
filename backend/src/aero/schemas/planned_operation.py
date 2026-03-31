from datetime import date
from typing import Literal

from pydantic import EmailStr, computed_field, model_validator

from aero.models.enums import WorkflowStatus
from aero.schemas.common import ORMModel


class RoutePoint(ORMModel):
    longitude: float
    latitude: float


class RouteGeometry(ORMModel):
    type: Literal["LineString"]
    coordinates: list[tuple[float, float]]


class PlannedOperationCreate(ORMModel):
    project_code: str
    short_description: str
    route_geometry: RouteGeometry | None = None
    kml_content: str | None = None
    proposed_date_from: date | None = None
    proposed_date_to: date | None = None
    planned_date_from: date | None = None
    planned_date_to: date | None = None
    activities: list[dict] | None = None
    extra_info: str | None = None
    contacts: list[EmailStr] | None = None

    @model_validator(mode="after")
    def validate_route_source(self) -> "PlannedOperationCreate":
        if not self.route_geometry and not self.kml_content:
            raise ValueError("Provide either route_geometry or kml_content")
        if self.route_geometry and self.kml_content:
            raise ValueError("Provide only one route source: route_geometry or kml_content")
        return self


class PlannedOperationUpdate(ORMModel):
    short_description: str | None = None
    route_geometry: RouteGeometry | None = None
    kml_content: str | None = None
    planned_date_from: date | None = None
    planned_date_to: date | None = None
    activities: list[dict] | None = None
    extra_info: str | None = None
    contacts: list[EmailStr] | None = None
    post_realization_notes: str | None = None

    @model_validator(mode="after")
    def validate_route_source(self) -> "PlannedOperationUpdate":
        if self.route_geometry and self.kml_content:
            raise ValueError("Provide only one route source: route_geometry or kml_content")
        return self


class PlannedOperationStatusUpdate(ORMModel):
    status: WorkflowStatus


class PlannedOperationRead(ORMModel):
    id: int
    project_code: str
    short_description: str
    route_geometry: RouteGeometry | None = None
    route_bbox: list[float] | None = None
    points_count: int
    distance_km: float
    status: WorkflowStatus
    created_by: int

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
