# Aero Backend API Endpoint Specs

> Editable source for Cursor: `docs/api/cursor-endpoint-spec.yaml`  
> This Markdown file is a human-readable reference.

This document reflects the currently implemented routes in `src/aero/api/routers/`, mounted under the `/api` prefix.

## Base URL

- API base path: `/api`
- Health check (outside API router): `/health`

## Authentication and Authorization

- Authentication uses `Authorization: Bearer <access_token>`.
- Login endpoint returns a token (`access_token`, `token_type`, `role`, `first_name`).
- Role values: `ADMIN`, `PLANNER`, `SUPERVISOR`, `PILOT`.
- Endpoints below list required roles from `require_roles(...)`.  
  If an endpoint says "Any authenticated user", it uses `current_user`.

## Common Query Parameters

Used by most list endpoints:

- `skip` (int, default `0`, min `0`)
- `limit` (int, default `50`, min `1`, max `200`)
- Optional sorting on some endpoints:
  - `sort_by` (string, default `id`)
  - `sort_dir` (`asc|desc`, default `asc`)

## Auth

### `POST /api/auth/register`

- Auth: none
- Body (`UserCreate`):
  - `first_name` (str)
  - `last_name` (str)
  - `email` (email)
  - `password` (str)
  - `role` (`ADMIN|PLANNER|SUPERVISOR|PILOT`)
- Response: `UserRead`

### `POST /api/auth/login`

- Auth: none
- Body (`LoginRequest`):
  - `email` (email)
  - `password` (str)
- Response: `TokenResponse`

## Users

### `GET /api/users`

- Auth: `ADMIN`, `SUPERVISOR`
- Query: `skip`, `limit`, `sort_by`, `sort_dir`
- Response: `list[UserRead]`

### `PATCH /api/users/{user_id}`

- Auth: `ADMIN`
- Body (`UserUpdate`, all optional):
  - `first_name` (str)
  - `last_name` (str)
  - `role` (`ADMIN|PLANNER|SUPERVISOR|PILOT`)
- Response: `UserRead`
- Errors:
  - `404` if user not found

## Helicopters

### `POST /api/helicopters`

- Auth: `ADMIN`, `PLANNER`, `SUPERVISOR`
- Body (`HelicopterCreate`):
  - `registration_number` (str, max 30)
  - `type` (str)
  - `description` (str | null)
  - `max_crew` (int, 1..10)
  - `max_crew_weight` (int, 1..1000)
  - `status` (`active|inactive`, default `active`)
  - `inspection_valid_until` (date | null; required when status is `active`)
  - `range_km` (int, >=1)
- Response: `HelicopterRead`
- Errors:
  - `409` on duplicate `registration_number`

### `GET /api/helicopters`

- Auth: `ADMIN`, `PLANNER`, `SUPERVISOR`, `PILOT`
- Query: `skip`, `limit`, `sort_by`, `sort_dir`
- Response: `list[HelicopterRead]`

### `PATCH /api/helicopters/{helicopter_id}`

- Auth: `ADMIN`, `PLANNER`, `SUPERVISOR`
- Body (`HelicopterUpdate`, all optional):
  - `registration_number`, `type`, `description`, `max_crew`, `max_crew_weight`, `status`, `inspection_valid_until`, `range_km`
- Response: `HelicopterRead`
- Errors:
  - `404` if helicopter not found
  - `409` on duplicate `registration_number`

### `PUT /api/helicopters/{helicopter_id}`

- Auth: `ADMIN`, `PLANNER`, `SUPERVISOR`
- Body: full `HelicopterCreate`
- Response: `HelicopterRead`
- Errors:
  - `404` if helicopter not found
  - `409` on duplicate `registration_number`

## Crew Members

### `POST /api/crew-members`

- Auth: `ADMIN`, `PLANNER`, `SUPERVISOR`
- Body (`CrewMemberCreate`):
  - `first_name` (str)
  - `last_name` (str)
  - `email` (email)
  - `weight` (int, 30..200)
  - `role` (`PILOT|OBSERVER`)
  - `pilot_license_number` (str | null)
  - `license_valid_until` (date | null)
  - `training_valid_until` (date)
- Validation:
  - If role is `PILOT`, `pilot_license_number` and `license_valid_until` are required.
- Response: `CrewMemberRead`

### `GET /api/crew-members`

- Auth: `ADMIN`, `PLANNER`, `SUPERVISOR`, `PILOT`
- Query: `skip`, `limit`, `sort_by`, `sort_dir`
- Response: `list[CrewMemberRead]`

### `PATCH /api/crew-members/{crew_member_id}`

- Auth: `ADMIN`, `PLANNER`, `SUPERVISOR`
- Body (`CrewMemberUpdate`, all optional):
  - `first_name`, `last_name`, `email`, `weight`, `role`, `pilot_license_number`, `license_valid_until`, `training_valid_until`
- Response: `CrewMemberRead`
- Errors:
  - `404` if crew member not found

## Landing Sites

### `POST /api/landing-sites`

- Auth: `ADMIN`, `PLANNER`, `SUPERVISOR`
- Body (`LandingSiteCreate`):
  - `name` (str)
  - `latitude` (float, -90..90)
  - `longitude` (float, -180..180)
- Response: `LandingSiteRead`

### `GET /api/landing-sites`

- Auth: `ADMIN`, `PLANNER`, `SUPERVISOR`, `PILOT`
- Query: `skip`, `limit`, `sort_by`, `sort_dir`
- Response: `list[LandingSiteRead]`

### `PATCH /api/landing-sites/{landing_site_id}`

- Auth: `ADMIN`, `PLANNER`, `SUPERVISOR`
- Body (`LandingSiteUpdate`, all optional):
  - `name`, `latitude`, `longitude`
- Response: `LandingSiteRead`
- Errors:
  - `404` if landing site not found

## Planned Operations

### `POST /api/planned-operations`

- Auth: `ADMIN`, `PLANNER`, `SUPERVISOR`
- Body (`PlannedOperationCreate`):
  - `project_code` (str)
  - `short_description` (str)
  - `route_geometry` (GeoJSON-like LineString object) OR `kml_content` (str)
  - `proposed_date_from` (date | null)
  - `proposed_date_to` (date | null)
  - `planned_date_from` (date | null)
  - `planned_date_to` (date | null)
  - `activities` (list[dict] | null)
  - `extra_info` (str | null)
  - `contacts` (list[email] | null)
- Validation:
  - Provide exactly one route source: `route_geometry` or `kml_content`.
- Response: `PlannedOperationRead`

### `POST /api/planned-operations/upload-kml`

- Auth: `ADMIN`, `PLANNER`, `SUPERVISOR`
- Content type: `multipart/form-data`
- Form fields:
  - `payload_json` (required string; valid JSON object matching `PlannedOperationCreate` without route)
  - `kml_file` (required file upload)
- Behavior:
  - Server reads KML content from file and injects it as `kml_content`.
- Response: `PlannedOperationRead`
- Errors:
  - `422` on invalid JSON/object or schema validation failures

### `GET /api/planned-operations`

- Auth: `ADMIN`, `PLANNER`, `SUPERVISOR`, `PILOT`
- Query:
  - `status_filter` (int, optional, `1..7`)
  - `skip`, `limit`
- Workflow status enum:
  - `1=DRAFT`, `2=SUBMITTED`, `3=APPROVED`, `4=SCHEDULED`, `5=IN_PROGRESS`, `6=DONE`, `7=REJECTED`
- Response: `list[PlannedOperationRead]`

### `PATCH /api/planned-operations/{operation_id}`

- Auth: `ADMIN`, `PLANNER`, `SUPERVISOR`
- Body (`PlannedOperationUpdate`, all optional):
  - `project_code`, `short_description`, `route_geometry`, `kml_content`, `planned_date_from`, `planned_date_to`, `activities`, `extra_info`, `contacts`, `post_realization_notes`
- Validation:
  - Cannot provide both `route_geometry` and `kml_content`.
  - Additional edit-window/status checks are enforced server-side.
- Response: `PlannedOperationRead`
- Errors:
  - `404` if planned operation not found

### `POST /api/planned-operations/{operation_id}/status`

- Auth: Any authenticated user
- Body (`PlannedOperationStatusUpdate`):
  - `status` (`1..7` workflow enum)
- Behavior:
  - Server enforces role-dependent status transition rules.
- Response: `PlannedOperationRead`
- Errors:
  - `404` if planned operation not found

## Flight Orders

### `POST /api/flight-orders`

- Auth: `PILOT`
- Body (`FlightOrderCreate`):
  - `planned_start` (datetime)
  - `planned_end` (datetime)
  - `pilot_id` (int | null, ignored when provided by client)
  - `helicopter_id` (int)
  - `crew_ids` (list[int], optional, default `[]`)
  - `start_site_id` (int)
  - `end_site_id` (int)
  - `planned_operation_ids` (list[int], required, min length `1`)
  - `estimated_distance` (float)
- Behavior:
  - Pilot is auto-resolved from currently logged user mapped to `CrewMember` with role `PILOT`.
  - Validates helicopter/pilot/crew constraints and assigns relationships.
  - Selected planned operations must exist and all have status `3` (`APPROVED`).
  - Helicopter must have status `active`.
- Response: `FlightOrderRead`
- Errors:
  - `400` if logged user is not mapped to pilot crew member, helicopter is inactive, planned operation status is invalid, or validation rules fail

### `GET /api/flight-orders`

- Auth: `ADMIN`, `PLANNER`, `SUPERVISOR`, `PILOT`
- Query: `skip`, `limit`
- Response: `list[FlightOrderRead]`

### `PATCH /api/flight-orders/{order_id}`

- Auth: `ADMIN`, `PILOT`, `PLANNER`, `SUPERVISOR`
- Body (`FlightOrderUpdate`, all optional):
  - `planned_start`, `planned_end`, `actual_start`, `actual_end`
  - `pilot_id`, `helicopter_id`, `crew_ids`
  - `start_site_id`, `end_site_id`
  - `estimated_distance`
  - `status` (flight-order status enum int: `1=NEW`, `2=SUBMITTED_FOR_APPROVAL`, `3=REJECTED`, `4=APPROVED`, `5=PARTIALLY_COMPLETED`, `6=COMPLETED`, `7=NOT_COMPLETED`)
  - `planned_operation_ids`
- Behavior:
  - Re-validates flight constraints when pilot/helicopter/crew/distance changes.
  - Updates planned operation links when `planned_operation_ids` is provided.
  - Requires `actual_start` and `actual_end` before setting status to `5` or `6`.
- Response: `FlightOrderRead`
- Errors:
  - `404` if flight order not found

### `POST /api/flight-orders/preview`

- Auth: `ADMIN`, `PLANNER`, `SUPERVISOR`, `PILOT`
- Body (`FlightOrderPreviewRequest`):
  - `start_site_id` (int)
  - `end_site_id` (int)
  - `helicopter_id` (int)
  - `planned_operation_ids` (list[int])
  - `strategy` (`optimized|input_order`, optional, default `optimized`)
- Response (`FlightOrderPreviewResponse`):
  - `ordered_operations` (list of operations with direction, entry/exit points, traversal distance)
  - `total_distance_km` (float)
  - `within_helicopter_range` (bool)
  - `range_margin_km` (float, positive = remaining range, negative = exceeded range)
  - `blocking_reasons` (list[str], e.g. `RANGE_EXCEEDED`)
  - `cache_hit` (bool)
- Behavior:
  - Recalculates operation execution order for interactive map preview.
  - Validates route distance against selected helicopter range.
  - Uses short-lived cache for repeated rapid requests from UI.
- Errors:
  - `404` if helicopter, landing site, or planned operation is missing
  - `422` on invalid input (duplicate planned operation IDs, too many operations)

## Common Error Responses

- `401 Unauthorized`: missing/invalid bearer token or token user not found.
- `403 Forbidden`: authenticated user lacks required role.
- `404 Not Found`: resource ID not found for update/status endpoints.
- `409 Conflict`: uniqueness conflict on helicopter registration.
- `422 Unprocessable Entity`: payload/schema validation issues.
