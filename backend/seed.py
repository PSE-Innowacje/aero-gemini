import os
import sys
from datetime import date, timedelta

from sqlalchemy import select


def main() -> None:
    backend_dir = os.path.dirname(__file__)
    src_path = os.path.join(backend_dir, "src")
    if src_path not in sys.path:
        sys.path.insert(0, src_path)

    from aero.core.database import Base, SessionLocal, engine  # noqa: WPS433
    from aero.core.security import hash_password  # noqa: WPS433
    from aero.models.crew_member import CrewMember  # noqa: WPS433
    from aero.models.enums import CrewRole, ResourceStatus, UserRole, WorkflowStatus  # noqa: WPS433
    from aero.models.flight_order import FlightOrder  # noqa: WPS433
    from aero.models.helicopter import Helicopter  # noqa: WPS433
    from aero.models.landing_site import LandingSite  # noqa: WPS433
    from aero.models.planned_operation import PlannedOperation  # noqa: WPS433
    from aero.models.user import User  # noqa: WPS433
    from aero.services.planned_operations import normalize_route  # noqa: WPS433

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        today = date.today()

        # Users for each role (for login/demo of role-specific visibility)
        user_specs = [
            ("Admin", "User", "admin@example.com", "admin123", UserRole.ADMIN),
            ("Paula", "Planner", "planner@example.com", "planner123", UserRole.PLANNER),
            ("Sam", "Supervisor", "supervisor@example.com", "supervisor123", UserRole.SUPERVISOR),
            ("Pete", "Pilot", "pilot-user@example.com", "pilot123", UserRole.PILOT),
        ]
        users_by_email: dict[str, User] = {}
        for first_name, last_name, email, password, role in user_specs:
            user = db.scalar(select(User).where(User.email == email))
            if not user:
                user = User(
                    first_name=first_name,
                    last_name=last_name,
                    email=email,
                    password_hash=hash_password(password),
                    role=role,
                )
                db.add(user)
                db.flush()
            users_by_email[email] = user
        admin = users_by_email["admin@example.com"]

        # Helicopters used in flight-order constraints and demo tables
        helicopter_specs = [
            {
                "registration_number": "SP-HELI1",
                "type": "AS350",
                "description": "Primary demo helicopter",
                "max_crew": 5,
                "max_crew_weight": 550,
                "status": ResourceStatus.ACTIVE,
                "inspection_valid_until": today + timedelta(days=220),
                "range_km": 450,
            },
            {
                "registration_number": "SP-HELI2",
                "type": "EC135",
                "description": "Secondary demo helicopter",
                "max_crew": 6,
                "max_crew_weight": 650,
                "status": ResourceStatus.ACTIVE,
                "inspection_valid_until": today + timedelta(days=300),
                "range_km": 620,
            },
            {
                "registration_number": "SP-HELI3",
                "type": "Bell 407",
                "description": "Reserve helicopter",
                "max_crew": 4,
                "max_crew_weight": 420,
                "status": ResourceStatus.INACTIVE,
                "inspection_valid_until": None,
                "range_km": 300,
            },
        ]
        helicopters_by_reg: dict[str, Helicopter] = {}
        for heli_data in helicopter_specs:
            registration = heli_data["registration_number"]
            heli = db.scalar(select(Helicopter).where(Helicopter.registration_number == registration))
            if not heli:
                heli = Helicopter(**heli_data)
                db.add(heli)
                db.flush()
            helicopters_by_reg[registration] = heli

        # Crew members with valid documents/training for demo flow
        crew_specs = [
            {
                "first_name": "Tom",
                "last_name": "Pilot",
                "email": "pilot@example.com",
                "weight": 82,
                "role": CrewRole.PILOT,
                "pilot_license_number": "LIC-1001",
                "license_valid_until": today + timedelta(days=365),
                "training_valid_until": today + timedelta(days=365),
            },
            {
                "first_name": "Alice",
                "last_name": "Pilot",
                "email": "pilot2@example.com",
                "weight": 78,
                "role": CrewRole.PILOT,
                "pilot_license_number": "LIC-1002",
                "license_valid_until": today + timedelta(days=420),
                "training_valid_until": today + timedelta(days=420),
            },
            {
                "first_name": "Olivia",
                "last_name": "Observer",
                "email": "observer@example.com",
                "weight": 74,
                "role": CrewRole.OBSERVER,
                "pilot_license_number": None,
                "license_valid_until": None,
                "training_valid_until": today + timedelta(days=300),
            },
            {
                "first_name": "Chris",
                "last_name": "Crew",
                "email": "crew1@example.com",
                "weight": 88,
                "role": CrewRole.CREW,
                "pilot_license_number": None,
                "license_valid_until": None,
                "training_valid_until": today + timedelta(days=280),
            },
            {
                "first_name": "Nina",
                "last_name": "Crew",
                "email": "crew2@example.com",
                "weight": 70,
                "role": CrewRole.CREW,
                "pilot_license_number": None,
                "license_valid_until": None,
                "training_valid_until": today + timedelta(days=310),
            },
        ]
        crew_by_email: dict[str, CrewMember] = {}
        for crew_data in crew_specs:
            email = crew_data["email"]
            member = db.scalar(select(CrewMember).where(CrewMember.email == email))
            if not member:
                member = CrewMember(**crew_data)
                db.add(member)
                db.flush()
            crew_by_email[email] = member

        # Landing sites for route selection
        site_specs = [
            ("Base A", 52.2297, 21.0122),
            ("Site B", 52.4064, 16.9252),
            ("Site C", 50.0647, 19.9450),
            ("Site D", 54.3520, 18.6466),
        ]
        sites_by_name: dict[str, LandingSite] = {}
        for name, lat, lng in site_specs:
            site = db.scalar(select(LandingSite).where(LandingSite.name == name))
            if not site:
                site = LandingSite(name=name, latitude=lat, longitude=lng)
                db.add(site)
                db.flush()
            sites_by_name[name] = site

        # Planned operations with varied statuses for list/status-demo screens
        operation_specs = [
            {
                "project_code": "PRJ-001",
                "short_description": "Power line inspection corridor A",
                "proposed_date_from": today + timedelta(days=1),
                "proposed_date_to": today + timedelta(days=2),
                "planned_date_from": today + timedelta(days=3),
                "planned_date_to": today + timedelta(days=4),
                "activities": [{"name": "Inspection", "duration_h": 2}],
                "extra_info": "Morning slot preferred",
                "route_geometry": {
                    "type": "LineString",
                    "coordinates": [
                        [21.0122, 52.2297],
                        [20.8000, 52.3000],
                        [20.5000, 52.3500],
                    ],
                },
                "status": WorkflowStatus.DRAFT,
                "contacts": ["contact@example.com"],
            },
            {
                "project_code": "PRJ-002",
                "short_description": "Thermal scan of industrial area",
                "proposed_date_from": today + timedelta(days=5),
                "proposed_date_to": today + timedelta(days=6),
                "planned_date_from": today + timedelta(days=7),
                "planned_date_to": today + timedelta(days=7),
                "activities": [{"name": "Thermal scan", "duration_h": 3}],
                "extra_info": "Coordinate with site supervisor",
                "route_geometry": {
                    "type": "LineString",
                    "coordinates": [
                        [19.9450, 50.0647],
                        [19.3000, 50.6000],
                        [18.6466, 54.3520],
                    ],
                },
                "status": WorkflowStatus.SUBMITTED,
                "contacts": ["thermal@example.com"],
            },
            {
                "project_code": "PRJ-003",
                "short_description": "Pipeline survey sector west",
                "proposed_date_from": today + timedelta(days=8),
                "proposed_date_to": today + timedelta(days=9),
                "planned_date_from": today + timedelta(days=10),
                "planned_date_to": today + timedelta(days=11),
                "activities": [{"name": "Survey", "duration_h": 4}],
                "extra_info": "High-priority compliance mission",
                "route_geometry": {
                    "type": "LineString",
                    "coordinates": [
                        [16.9252, 52.4064],
                        [17.8000, 52.0000],
                        [19.9450, 50.0647],
                    ],
                },
                "status": WorkflowStatus.APPROVED,
                "contacts": ["ops@example.com"],
            },
        ]
        operations_by_code: dict[str, PlannedOperation] = {}
        for op_data in operation_specs:
            code = op_data["project_code"]
            operation = db.scalar(select(PlannedOperation).where(PlannedOperation.project_code == code))
            normalized_route = normalize_route(
                route_geometry=op_data["route_geometry"],
                kml_content=None,
            )
            if not operation:
                operation = PlannedOperation(
                    project_code=op_data["project_code"],
                    short_description=op_data["short_description"],
                    route_geometry=normalized_route["route_geometry"],
                    route_bbox=normalized_route["route_bbox"],
                    points_count=normalized_route["points_count"],
                    proposed_date_from=op_data["proposed_date_from"],
                    proposed_date_to=op_data["proposed_date_to"],
                    planned_date_from=op_data["planned_date_from"],
                    planned_date_to=op_data["planned_date_to"],
                    activities=op_data["activities"],
                    extra_info=op_data["extra_info"],
                    distance_km=normalized_route["distance_km"],
                    status=op_data["status"],
                    created_by=admin.id,
                    contacts=op_data["contacts"],
                    post_realization_notes=None,
                )
                db.add(operation)
                db.flush()
            else:
                operation.route_geometry = normalized_route["route_geometry"]
                operation.route_bbox = normalized_route["route_bbox"]
                operation.points_count = normalized_route["points_count"]
                operation.distance_km = normalized_route["distance_km"]
            operations_by_code[code] = operation

        # Flight orders tying together helicopters, crew, sites and operations
        flight_order_specs = [
            {
                "planned_start": None,
                "planned_end": None,
                "pilot_email": "pilot@example.com",
                "helicopter_reg": "SP-HELI1",
                "crew_emails": ["observer@example.com", "crew1@example.com"],
                "start_site_name": "Base A",
                "end_site_name": "Site B",
                "estimated_distance": 100.0,
                "operation_codes": ["PRJ-001"],
                "status": WorkflowStatus.DRAFT,
            },
            {
                "planned_start": None,
                "planned_end": None,
                "pilot_email": "pilot2@example.com",
                "helicopter_reg": "SP-HELI2",
                "crew_emails": ["crew2@example.com"],
                "start_site_name": "Site C",
                "end_site_name": "Site D",
                "estimated_distance": 150.0,
                "operation_codes": ["PRJ-002", "PRJ-003"],
                "status": WorkflowStatus.APPROVED,
            },
        ]
        for order_data in flight_order_specs:
            pilot = crew_by_email[order_data["pilot_email"]]
            helicopter = helicopters_by_reg[order_data["helicopter_reg"]]
            start_site = sites_by_name[order_data["start_site_name"]]
            end_site = sites_by_name[order_data["end_site_name"]]
            crew_members = [crew_by_email[email] for email in order_data["crew_emails"]]
            planned_operations = [operations_by_code[code] for code in order_data["operation_codes"]]
            crew_weight = int(sum(member.weight for member in crew_members))
            existing = db.scalar(
                select(FlightOrder).where(
                    FlightOrder.pilot_id == pilot.id,
                    FlightOrder.helicopter_id == helicopter.id,
                    FlightOrder.start_site_id == start_site.id,
                    FlightOrder.end_site_id == end_site.id,
                    FlightOrder.estimated_distance == order_data["estimated_distance"],
                )
            )
            if not existing:
                existing = FlightOrder(
                    planned_start=order_data["planned_start"],
                    planned_end=order_data["planned_end"],
                    pilot_id=pilot.id,
                    helicopter_id=helicopter.id,
                    start_site_id=start_site.id,
                    end_site_id=end_site.id,
                    crew_weight=crew_weight,
                    estimated_distance=order_data["estimated_distance"],
                    status=order_data["status"],
                )
                existing.pilot = pilot
                existing.helicopter = helicopter
                existing.crew_members = crew_members
                existing.planned_operations = planned_operations
                db.add(existing)

        db.commit()
        print("Seed data inserted (idempotent).")
    finally:
        db.close()


if __name__ == "__main__":
    main()

