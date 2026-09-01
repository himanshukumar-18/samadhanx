from fastapi import APIRouter

from app.api.v1.endpoints import system
from app.api.v1.endpoints.admin import router as admin_router
from app.api.v1.endpoints.auth import router as auth_router
from app.api.v1.endpoints.chat import router as chat_router
from app.api.v1.endpoints.citizen import router as citizen_router
from app.api.v1.endpoints.faculty import router as faculty_router
from app.api.v1.endpoints.industry import router as industry_router
from app.api.v1.endpoints.notifications import router as notifications_router
from app.api.v1.endpoints.problems import router as problems_router
from app.api.v1.endpoints.profile import router as profile_router
from app.api.v1.endpoints.projects import router as projects_router
from app.api.v1.endpoints.settings import router as settings_router
from app.api.v1.endpoints.social import router as social_router
from app.api.v1.endpoints.student import router as student_router
from app.api.v1.endpoints.university import router as university_router

api_router = APIRouter()

# Core system diagnostics
api_router.include_router(system.router)

# Auth & User Identity
api_router.include_router(auth_router)

# Role & Domain Workspace Modules
api_router.include_router(citizen_router)
api_router.include_router(problems_router)
api_router.include_router(student_router)
api_router.include_router(projects_router)
api_router.include_router(faculty_router)
api_router.include_router(industry_router)
api_router.include_router(university_router)
api_router.include_router(admin_router)
api_router.include_router(notifications_router)

# Social Collaboration & Chat Modules
api_router.include_router(social_router)
api_router.include_router(chat_router)
api_router.include_router(settings_router)
api_router.include_router(profile_router)
