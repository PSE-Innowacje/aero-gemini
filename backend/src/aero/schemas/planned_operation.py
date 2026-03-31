from datetime import date

from pydantic import EmailStr

from aero.models.enums import WorkflowStatus
from aero.schemas.common import ORMModel


class PlannedOperationCreate(ORMModel):
    project_code: str
    short_description: str
    kml_file_path: str | None = None
    proposed_date_from: date | None = None
    proposed_date_to: date | None = None
    planned_date_from: date | None = None
    planned_date_to: date | None = None
    activities: list[dict] | None = None
    extra_info: str | None = None
    contacts: list[EmailStr] | None = None


class PlannedOperationUpdate(ORMModel):
    short_description: str | None = None
    planned_date_from: date | None = None
    planned_date_to: date | None = None
    activities: list[dict] | None = None
    extra_info: str | None = None
    contacts: list[EmailStr] | None = None
    post_realization_notes: str | None = None


class PlannedOperationStatusUpdate(ORMModel):
    status: WorkflowStatus


class PlannedOperationRead(ORMModel):
    id: int
    project_code: str
    short_description: str
    distance_km: float
    status: WorkflowStatus
    created_by: int
