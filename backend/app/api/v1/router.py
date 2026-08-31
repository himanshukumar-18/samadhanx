from fastapi import APIRouter

from app.api.v1.endpoints import system
from app.api.v1.endpoints.admin import router as admin_router
from app.api.v1.endpoints.auth import router as auth_router
from app.api.v1.endpoints.university import router as university_router

api_router = APIRouter()

# Core system diagnostics
api_router.include_router(system.router)

# Phase 1 Auth, Roles, Admin & University Routers
api_router.include_router(auth_router)
api_router.include_router(admin_router)
api_router.include_router(university_router)
