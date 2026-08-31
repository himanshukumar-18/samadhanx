from fastapi import APIRouter

from app.api.v1.endpoints import system

api_router = APIRouter()

# Register core v1 routers
api_router.include_router(system.router)
