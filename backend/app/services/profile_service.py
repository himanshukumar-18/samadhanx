import re
import uuid

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog
from app.models.enums import UserRole
from app.models.user import User
from app.repositories.profile_repository import ProfileRepository
from app.repositories.social_repository import SocialRepository
from app.schemas.profile_detail import CitizenProfileStats, UserProfileDetailResponse, UserProfileUpdate


def sanitize_bio(text: str | None) -> str | None:
    if not text:
        return text
    clean = re.sub(r"<[^>]*>", "", text)
    return clean.strip()


class ProfileService:
    def __init__(self, db: AsyncSession):
        self.db = db
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

        # Citizen specific fields & computed stats
        cp = user.citizen_profile
        stats_dict = await self.repo.get_citizen_problem_stats(target_user_id)
        stats = CitizenProfileStats(**stats_dict)

        headline = (cp.headline if cp and cp.headline else detail.headline) or None
        bio = (cp.bio if cp and cp.bio else detail.bio) or None
        website_url = (cp.website_url if cp and cp.website_url else detail.website) or None
        github_url = (cp.github_url if cp and cp.github_url else detail.github_url) or None
        linkedin_url = (cp.linkedin_url if cp and cp.linkedin_url else detail.linkedin_url) or None
        avatar_url = (cp.profile_picture_url if cp and cp.profile_picture_url else detail.avatar_url) or None

        return UserProfileDetailResponse(
            user_id=user.id,
            email=user.email,
            full_name=user.full_name,
            role=user.role.value,
            organization_name=org_name,
            bio=bio,
            headline=headline,
            avatar_url=avatar_url,
            profile_picture_url=avatar_url,
            cover_url=detail.cover_url,
            website=website_url,
            website_url=website_url,
            github_url=github_url,
            linkedin_url=linkedin_url,
            skills=detail.skills or [],
            experience=detail.experience or [],
            education=detail.education or [],
            followers_count=followers_cnt,
            following_count=following_cnt,
            is_following=is_following,
            is_verified=user.is_verified,
            created_at=user.created_at,
            stats=stats,
        )

    async def update_my_profile(self, current_user: User, data: UserProfileUpdate) -> UserProfileDetailResponse:
        update_dict = data.model_dump(exclude_unset=True)

        # Convert HttpUrl objects to str if present
        for field in ["website_url", "github_url", "linkedin_url", "avatar_url", "profile_picture_url", "website"]:
            if field in update_dict and update_dict[field] is not None:
                update_dict[field] = str(update_dict[field])

        if "bio" in update_dict and update_dict["bio"]:
            update_dict["bio"] = sanitize_bio(update_dict["bio"])

        # Update UserProfileDetail
        if "website_url" in update_dict and "website" not in update_dict:
            update_dict["website"] = update_dict["website_url"]
        await self.repo.update_detail(current_user.id, update_dict)

        # Update CitizenProfile if citizen
        if current_user.role == UserRole.CITIZEN:
            cp_dict = {}
            for k in ["headline", "bio", "website_url", "github_url", "linkedin_url", "profile_picture_url"]:
                if k in update_dict:
                    cp_dict[k] = update_dict[k]
                elif k == "website_url" and "website" in update_dict:
                    cp_dict["website_url"] = update_dict["website"]
                elif k == "profile_picture_url" and "avatar_url" in update_dict:
                    cp_dict["profile_picture_url"] = update_dict["avatar_url"]

            if cp_dict:
                await self.repo.update_citizen_profile(current_user.id, cp_dict)

        # Add AuditLog entry
        audit = AuditLog(
            actor_id=current_user.id,
            action="profile_updated",
            target_type="user_profile",
            target_id=str(current_user.id),
            metadata_json={"updated_fields": list(update_dict.keys())},
        )
        self.db.add(audit)
        await self.db.commit()

        return await self.get_profile(current_user, current_user.id)
