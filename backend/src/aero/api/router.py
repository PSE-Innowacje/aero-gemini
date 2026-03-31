from fastapi import APIRouter

from aero.api.routers import auth, crew_members, flight_orders, helicopters, landing_sites, planned_operations, users

api_router = APIRouter()
api_router.include_router(auth.router, tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(helicopters.router, prefix="/helicopters", tags=["helicopters"])
api_router.include_router(crew_members.router, prefix="/crew-members", tags=["crew-members"])
api_router.include_router(landing_sites.router, prefix="/landing-sites", tags=["landing-sites"])
api_router.include_router(planned_operations.router, prefix="/planned-operations", tags=["planned-operations"])
api_router.include_router(flight_orders.router, prefix="/flight-orders", tags=["flight-orders"])
