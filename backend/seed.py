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
    from aero.models.helicopter import Helicopter  # noqa: WPS433
    from aero.models.landing_site import LandingSite  # noqa: WPS433
    from aero.models.planned_operation import PlannedOperation  # noqa: WPS433
    from aero.models.user import User  # noqa: WPS433

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # Admin user
        admin = db.scalar(select(User).where(User.email == "admin@example.com"))
        if not admin:
            admin = User(
                first_name="Admin",
                last_name="User",
                email="admin@example.com",
                password_hash=hash_password("admin123"),
                role=UserRole.ADMIN,
            )
            db.add(admin)
            db.flush()  # ensure admin.id is available

        # Helicopter
        heli = db.scalar(select(Helicopter).where(Helicopter.registration_number == "SP-HELI1"))
        if not heli:
            heli = Helicopter(
                registration_number="SP-HELI1",
                type="AS350",
                description="Demo helicopter",
                max_crew=5,
                max_crew_weight=600,
                status=ResourceStatus.ACTIVE,
                inspection_valid_until=date.today() + timedelta(days=180),
                range_km=300,
            )
            db.add(heli)

        # Crew: pilot + observer
        pilot = db.scalar(select(CrewMember).where(CrewMember.email == "pilot@example.com"))
        if not pilot:
            pilot = CrewMember(
                first_name="Test",
                last_name="Pilot",
                email="pilot@example.com",
                weight=80,
                role=CrewRole.PILOT,
                pilot_license_number="LIC-123",
                license_valid_until=date.today() + timedelta(days=365),
                training_valid_until=date.today() + timedelta(days=365),
            )
            db.add(pilot)

        observer = db.scalar(select(CrewMember).where(CrewMember.email == "observer@example.com"))
        if not observer:
            observer = CrewMember(
                first_name="Obs",
                last_name="Server",
                email="observer@example.com",
                weight=75,
                role=CrewRole.OBSERVER,
                pilot_license_number=None,
                license_valid_until=None,
                training_valid_until=date.today() + timedelta(days=365),
            )
            db.add(observer)

        # Landing sites
        site_a = db.scalar(select(LandingSite).where(LandingSite.name == "Base A"))
        if not site_a:
            site_a = LandingSite(name="Base A", latitude=52.2297, longitude=21.0122)
            db.add(site_a)

        site_b = db.scalar(select(LandingSite).where(LandingSite.name == "Site B"))
        if not site_b:
            site_b = LandingSite(name="Site B", latitude=52.4064, longitude=16.9252)
            db.add(site_b)

        # Planned operation
        op = db.scalar(select(PlannedOperation).where(PlannedOperation.project_code == "PRJ-001"))
        if not op:
            op = PlannedOperation(
                project_code="PRJ-001",
                short_description="Demo inspection flight",
                kml_file_path=None,
                proposed_date_from=date.today() + timedelta(days=1),
                proposed_date_to=date.today() + timedelta(days=2),
                planned_date_from=None,
                planned_date_to=None,
                activities=[{"name": "Inspection", "duration_h": 2}],
                extra_info="Seed demo operation",
                distance_km=120.0,
                status=WorkflowStatus.DRAFT,
                created_by=admin.id,
                contacts=["contact@example.com"],
                post_realization_notes=None,
            )
            db.add(op)

        db.commit()
        print("Seed data inserted (idempotent).")
    finally:
        db.close()


if __name__ == "__main__":
    main()

