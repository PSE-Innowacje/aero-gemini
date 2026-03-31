You are a senior frontend engineer.

Build a React application based on the following backend and product requirements.

# 🧱 Tech stack

* React + TypeScript
* Vite
* React Router
* React Query (data fetching)
* Zustand or Context API (state)
* Tailwind CSS (UI)
* Mapbox or OpenStreetMap (map rendering)

# 🧭 App Structure

## Main Layout

* Sidebar menu
* Top bar (user info, logout)
* Content area

## Navigation

Sections:

1. Administracja

* Helicopters
* Crew Members
* Landing Sites
* Users

2. Planowanie operacji

* Planned Operations List

3. Zlecenia na lot

* Flight Orders List

# 🔐 Auth

* Login screen (email + password)
* Store JWT
* Role-based UI rendering

# 👥 Role-based UI

* ADMIN: full access
* PLANNER:

  * access only Planned Operations
* SUPERVISOR:

  * operations + flight orders
* PILOT:

  * flight orders

Hide menu items based on role.

# 📋 Views

## Helicopters

* Table (registration, type, status)
* Create/Edit form

## Crew

* Table (email, role, license dates)
* Form with validation

## Landing Sites

* Table + map preview
* Form with coordinates picker (map click)

## Planned Operations

### List

* Table with filters:

  * status (default = 3)
  * date ranges
* Columns:

  * id, project_code, activities, dates, status

### Form

* Upload KML
* Select activities (multi-select)
* Dates
* Description

### Details

* Map:

  * display KML path
* Status actions (buttons depending on role)

## Flight Orders

### List

* Table:

  * id, start time, helicopter, pilot, status
* Default filter = status 2

### Form

* Select:

  * pilot (auto-filled)
  * helicopter
  * crew (multi)
  * landing sites
  * planned operations (multi)
* Show computed:

  * crew weight
  * estimated distance

### Map

* Show:

  * start site
  * end site
  * operations paths

### Validation UI

Show clear errors:

* overweight
* expired license
* helicopter range exceeded

# 🗺️ Map

Use Mapbox or OpenStreetMap:

* Draw polyline from KML
* Markers for landing sites

# 🎛️ UX

* Use modals for create/edit
* Toast notifications
* Loading states (spinners)
* Error handling

# 🔄 API Integration

* Use React Query
* Separate API layer
* Handle pagination + filters

# 🎯 Goal

Deliver clean, modern UI for managing aviation operations with map visualization and role-based workflows.