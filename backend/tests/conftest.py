"""Pytest fixtures for backend integration tests."""

from collections.abc import Callable, Generator
from datetime import date, timedelta
from pathlib import Path
import sys

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

PROJECT_ROOT = Path(__file__).resolve().parents[1]
SRC_PATH = PROJECT_ROOT / "src"
if str(SRC_PATH) not in sys.path:
    sys.path.insert(0, str(SRC_PATH))

from aero.core.database import Base, get_db  # noqa: E402
from aero.main import app as fastapi_app  # noqa: E402
from aero.models.crew_member import CrewMember  # noqa: E402
from aero.models.enums import CrewRole, ResourceStatus, UserRole, WorkflowStatus  # noqa: E402
from aero.models.helicopter import Helicopter  # noqa: E402
from aero.models.landing_site import LandingSite  # noqa: E402
from aero.models.planned_operation import PlannedOperation  # noqa: E402
from aero.models.user import User  # noqa: E402


@pytest.fixture
def db_session(tmp_path: Path) -> Generator[Session, None, None]:
    db_path = tmp_path / "test.db"
    engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client(db_session: Session) -> Generator[TestClient, None, None]:
    def override_get_db() -> Generator[Session, None, None]:
        try:
            yield db_session
        finally:
            pass

    fastapi_app.dependency_overrides[get_db] = override_get_db
    with TestClient(fastapi_app) as test_client:
        yield test_client
    fastapi_app.dependency_overrides.clear()


def _register_and_login(client: TestClient, email: str, role: str) -> str:
    register_payload = {
        "first_name": "Test",
        "last_name": role,
        "email": email,
        "password": "secret123",
        "role": role,
    }
    register_response = client.post("/api/auth/register", json=register_payload)
    assert register_response.status_code == 200
    login_response = client.post("/api/auth/login", json={"email": email, "password": "secret123"})
    assert login_response.status_code == 200
    return login_response.json()["access_token"]


@pytest.fixture
def admin_token(client: TestClient) -> str:
    return _register_and_login(client, "admin@example.com", UserRole.ADMIN.value)


@pytest.fixture
def planner_token(client: TestClient) -> str:
    return _register_and_login(client, "planner@example.com", UserRole.PLANNER.value)


@pytest.fixture
def supervisor_token(client: TestClient) -> str:
    return _register_and_login(client, "supervisor@example.com", UserRole.SUPERVISOR.value)


@pytest.fixture
def pilot_user_token(client: TestClient) -> str:
    return _register_and_login(client, "pilot-user@example.com", UserRole.PILOT.value)


@pytest.fixture
def authz() -> Callable[[str], dict[str, str]]:
    def _authz(token: str) -> dict[str, str]:
        return {"Authorization": f"Bearer {token}"}

    return _authz


@pytest.fixture
def operational_entities(db_session: Session) -> dict[str, int]:
    operation_creator = User(
        first_name="System",
        last_name="Seed",
        email="system-seed@example.com",
        password_hash="seed",
        role=UserRole.ADMIN,
    )
    helicopter = Helicopter(
        registration_number="SP-TEST1",
        type="AW109",
        description="test",
        max_crew=5,
        max_crew_weight=250,
        status=ResourceStatus.ACTIVE,
        inspection_valid_until=date.today() + timedelta(days=30),
        range_km=200,
    )
    pilot = CrewMember(
        first_name="Pilot",
        last_name="One",
        email="pilot-user@example.com",
        weight=80,
        role=CrewRole.PILOT,
        pilot_license_number="LIC-1",
        license_valid_until=date.today() + timedelta(days=30),
        training_valid_until=date.today() + timedelta(days=30),
    )
    observer = CrewMember(
        first_name="Observer",
        last_name="One",
        email="crew-observer@example.com",
        weight=70,
        role=CrewRole.OBSERVER,
        pilot_license_number=None,
        license_valid_until=None,
        training_valid_until=date.today() + timedelta(days=30),
    )
    site_a = LandingSite(name="A", latitude=52.1, longitude=21.0)
    site_b = LandingSite(name="B", latitude=52.2, longitude=21.1)
    db_session.add(operation_creator)
    db_session.flush()
    approved_operation = PlannedOperation(
        project_code="PRJ-BASE-APPROVED",
        short_description="Base approved operation",
        route_geometry={
            "type": "LineString",
            "coordinates": [[21.01, 52.11], [21.03, 52.12], [21.06, 52.14]],
        },
        status=WorkflowStatus.APPROVED,
        created_by=operation_creator.id,
    )
    db_session.add_all([helicopter, pilot, observer, site_a, site_b, approved_operation])
    db_session.commit()
    return {
        "helicopter_id": helicopter.id,
        "pilot_id": pilot.id,
        "observer_id": observer.id,
        "site_a_id": site_a.id,
        "site_b_id": site_b.id,
        "approved_operation_id": approved_operation.id,
    }