import uuid

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.repositories.profile_repository import ProfileRepository
from app.repositories.social_repository import SocialRepository
from app.schemas.profile_detail import UserProfileDetailResponse, UserProfileUpdate


class ProfileService:
    def __init__(self, db: AsyncSession):
        self.repo = ProfileRepository(db)
        self.social_repo = SocialRepository(db)

    async def get_profile(self, current_user: User, target_user_id: uuid.UUID) -> UserProfileDetailResponse:
        user = await self.repo.get_user_with_profiles(target_user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "USER_NOT_FOUND", "message": "The requested user profile does not exist."},
            )

        detail = await self.repo.get_or_create_detail(target_user_id)
        followers_cnt, following_cnt = await self.social_repo.get_connection_stats(target_user_id)
        is_following = await self.social_repo.is_following(current_user.id, target_user_id)

        org_name = None
        if user.student_profile and user.student_profile.university:
            org_name = user.student_profile.university.university_name
        elif user.faculty_profile and user.faculty_profile.university:
            org_name = user.faculty_profile.university.university_name
        elif user.university_profile:
            org_name = user.university_profile.university_name
        elif user.industry_profile:
            org_name = user.industry_profile.company_name

        return UserProfileDetailResponse(
            user_id=user.id,
            email=user.email,
            full_name=user.full_name,
            role=user.role.value,
            organization_name=org_name,
            bio=detail.bio,
            headline=detail.headline,
            avatar_url=detail.avatar_url,
            cover_url=detail.cover_url,
            website=detail.website,
            github_url=detail.github_url,
            linkedin_url=detail.linkedin_url,
            skills=detail.skills or [],
            experience=detail.experience or [],
            education=detail.education or [],
            followers_count=followers_cnt,
            following_count=following_cnt,
            is_following=is_following,
            is_verified=user.is_verified,
            created_at=user.created_at,
        )

    async def update_my_profile(self, current_user: User, data: UserProfileUpdate) -> UserProfileDetailResponse:
        update_dict = data.model_dump(exclude_unset=True)
        await self.repo.update_detail(current_user.id, update_dict)
        return await self.get_profile(current_user, current_user.id)
