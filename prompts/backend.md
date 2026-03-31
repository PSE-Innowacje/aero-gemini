You are a senior backend engineer.

Build a backend application based on the following requirements.

# 🧱 Tech stack

* Python 3.12
* FastAPI
* SQLAlchemy (ORM)
* SQLite (database)
* Pydantic for validation
* Alembic for migrations

# 🧩 Architecture

* Modular structure:

  * /app
    * /api (routers)
    * /models (SQLAlchemy)
    * /schemas (Pydantic)
    * /services (business logic)
    * /repositories (DB access)
    * /core (config, security)
* Use dependency injection
* Separate business logic from API layer

# 🔐 Auth & Roles

Implement simple authentication (JWT or session-based).

Roles:
* ADMIN
* PLANNER
* SUPERVISOR
* PILOT

Add role-based access control (RBAC) on endpoints.

# 🗄️ Entities (models)

## Helicopter

* id
* registration_number (string, required, max 30)
* type (string, required)
* description (optional)
* max_crew (int 1–10)
* max_crew_weight (int 1–1000)
* status (active/inactive)
* inspection_valid_until (date, required if active)
* range_km (int)

## CrewMember

* id
* first_name
* last_name
* email
* weight (30–200)
* role (enum: PILOT, OBSERVER, etc.)
* pilot_license_number (required if role=PILOT)
* license_valid_until (required if PILOT)
* training_valid_until (required)

## LandingSite

* id
* name
* latitude
* longitude

## User

* id
* first_name
* last_name
* email
* password_hash
* role (ADMIN, PLANNER, SUPERVISOR, PILOT)

## PlannedOperation

* id (auto increment number)
* project_code
* short_description
* kml_file_path
* proposed_date_from
* proposed_date_to
* planned_date_from
* planned_date_to
* activities (array / JSON)
* extra_info
* distance_km (computed)
* status (1–7 enum)
* created_by (user)
* contacts (list of emails)
* post_realization_notes
* created_at
* updated_at

## FlightOrder

* id
* planned_start
* planned_end
* actual_start
* actual_end
* pilot_id
* helicopter_id
* crew_ids (many-to-many)
* start_site_id
* end_site_id
* planned_operations (many-to-many)
* crew_weight (computed)
* estimated_distance
* status (1–7 enum)

# ⚙️ Business Logic

## PlannedOperation

* Parse KML file → extract points
* Calculate approximate distance (sum of segments)
* Status transitions:

  * 1 → 2 / 3 (supervisor)
  * 3 → 4 (when added to flight order)
  * 4 → 5 / 6 / 3 (pilot actions)
* Restrict editing fields by role

## FlightOrder validations

Block save if:

* helicopter inspection expired
* pilot license expired
* crew training expired
* crew weight > helicopter limit
* estimated distance > helicopter range

## Status transitions

Implement strict validation of allowed transitions.

# 🌍 Map data

Return geo data in API:

* KML parsed into list of coordinates
* Landing sites coordinates

# 📡 API Endpoints

Create REST endpoints for:

* CRUD: helicopters, crew, landing sites, users
* Planned operations:

  * create, update, list, filter, status change
* Flight orders:

  * create, update, assign operations
  * validate constraints
  * status changes

Add filtering, sorting, pagination.

# 📊 Additional

* Add audit/history for PlannedOperation changes
* Use enums for statuses
* Add seed script with sample data


# 🎯 Goal

Produce production-ready backend with clean architecture and working API.