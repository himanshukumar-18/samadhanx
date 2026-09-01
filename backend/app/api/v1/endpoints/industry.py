import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_active_user, get_db, require_role
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.industry import (
    IndustrySupportCreate,
    IndustrySupportResponse,
    IndustrySupportUpdateStatus,
)
from app.services.industry_service import IndustryService

router = APIRouter(prefix="/industry", tags=["Industry Partner & CSR"])


@router.get("/dashboard", response_model=dict)
async def get_industry_dashboard(
    current_user: Annotated[User, Depends(require_role([UserRole.INDUSTRY, UserRole.ADMIN]))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    service = IndustryService(db)
    my_supports = await service.list_my_supports(current_user)

    company_name = (
        current_user.industry_profile.company_name
        if current_user.industry_profile
        else current_user.email
    )

    return {
        "company_name": company_name,
        "contact_person": current_user.industry_profile.point_of_contact_name if current_user.industry_profile else None,
        "designation": current_user.industry_profile.designation if current_user.industry_profile else None,
        "total_supported_projects_count": len(my_supports),
        "pending_intents_count": sum(1 for s in my_supports if s.status == "pending"),
    }


@router.post("/support", response_model=IndustrySupportResponse, status_code=status.HTTP_201_CREATED)
async def submit_support_intent(
    data: IndustrySupportCreate,
    current_user: Annotated[User, Depends(require_role([UserRole.INDUSTRY, UserRole.ADMIN]))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    service = IndustryService(db)
    return await service.create_support_intent(industry_user=current_user, data=data)


@router.get("/support/my", response_model=list[IndustrySupportResponse])
async def list_my_supports(
    current_user: Annotated[User, Depends(require_role([UserRole.INDUSTRY, UserRole.ADMIN]))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    service = IndustryService(db)
    return await service.list_my_supports(current_user)


@router.patch("/support/{support_id}/status", response_model=IndustrySupportResponse)
async def update_support_status(
    support_id: uuid.UUID,
    data: IndustrySupportUpdateStatus,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    service = IndustryService(db)
    return await service.update_status(user=current_user, support_id=support_id, data=data)
