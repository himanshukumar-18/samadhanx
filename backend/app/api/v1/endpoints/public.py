import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db
from app.models.enums import RequestStatus
from app.models.profiles import UniversityProfile
from app.models.restricted_request import RestrictedAccountRequest
from app.models.user import User

router = APIRouter(prefix="/public", tags=["Public Data API"])

# Cache for public approved universities
_APPROVED_UNIVERSITIES_CACHE: list[dict] | None = None


def invalidate_public_universities_cache():
    global _APPROVED_UNIVERSITIES_CACHE
    _APPROVED_UNIVERSITIES_CACHE = None


@router.get("/universities")
async def list_approved_universities(
    db: Annotated[AsyncSession, Depends(get_db)],
):
    global _APPROVED_UNIVERSITIES_CACHE
    if _APPROVED_UNIVERSITIES_CACHE is not None:
        return {"success": True, "data": _APPROVED_UNIVERSITIES_CACHE}

    # Query only approved universities where linked User is active & approved
    query = (
        select(UniversityProfile)
        .join(User, UniversityProfile.user_id == User.id)
        .outerjoin(RestrictedAccountRequest, User.id == RestrictedAccountRequest.user_id)
        .where(
            UniversityProfile.is_approved == True,
            User.is_active == True,
            User.is_approved == True,
            (RestrictedAccountRequest.status == RequestStatus.APPROVED) | (RestrictedAccountRequest.id == None),
        )
        .order_by(UniversityProfile.university_name.asc())
    )

    result = await db.execute(query)
    universities = result.scalars().all()

    data = [
        {
            "id": str(u.id),
            "name": u.university_name,
            "city": u.district,
            "state": u.state,
        }
        for u in universities
    ]

    _APPROVED_UNIVERSITIES_CACHE = data
    return {"success": True, "data": data}
