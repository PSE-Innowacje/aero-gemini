from enum import Enum


class UserRole(str, Enum):
    ADMIN = "ADMIN"
    PLANNER = "PLANNER"
    SUPERVISOR = "SUPERVISOR"
    PILOT = "PILOT"


class CrewRole(str, Enum):
    PILOT = "PILOT"
    OBSERVER = "OBSERVER"


class ResourceStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class WorkflowStatus(int, Enum):
    DRAFT = 1
    SUBMITTED = 2
    APPROVED = 3
    SCHEDULED = 4
    IN_PROGRESS = 5
    DONE = 6
    REJECTED = 7
