import re
import uuid
from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog
from app.models.user import User
from app.repositories.profile_repository import ProfileRepository
from app.repositories.social_repository import SocialRepository
from app.schemas.profile_detail import (
    CitizenActivityStats,
    CitizenProfileResponse,
    CitizenProfileStats,
    CitizenProfileUpdate,
    PublicActivityStats,
    PublicUserProfileResponse,
    UserProfileDetailResponse,
    UserProfileUpdate,
)


def sanitize_bio(text: str | None) -> str | None:
    if not text:
        return text
    clean = re.sub(r"<[^>]*>", "", text)
    return clean.strip()


def _member_since(dt: datetime) -> str:
    """Format a datetime as 'Month YYYY', e.g. 'September 2026'."""
    return dt.strftime("%B %Y")


class ProfileService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = ProfileRepository(db)
        self.social_repo = SocialRepository(db)

    # ------------------------------------------------------------------
    # Public profile (privacy-clean, read-only, for any viewer)
    # ------------------------------------------------------------------

    async def get_public_profile(self, target_user_id: uuid.UUID) -> PublicUserProfileResponse:
        """
        Return the privacy-clean public profile for any user.

        Privacy guarantees:
        - Never returns: email, phone, DOB, full_address, pincode,
          password, OTP, tokens, admin notes, or moderation data.
        - Location: state + district + city only (NOT pincode/full address).
        - Suspended/deactivated users: name + account_available=False only.
        - Missing user: raises 404.
        """
        from sqlalchemy import select
        from sqlalchemy.orm import selectinload

        from app.models.user import User as UserModel

        # Eagerly load citizen_profile and profile_detail in a single async query.
        # Without selectinload, accessing user.citizen_profile would trigger a
        # synchronous lazy load which is illegal with asyncpg → MissingGreenlet.
        result = await self.db.execute(
            select(UserModel)
            .options(
                selectinload(UserModel.citizen_profile),
                selectinload(UserModel.profile_detail),
            )
            .where(UserModel.id == target_user_id)
        )
        user = result.scalar_one_or_none()

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "USER_NOT_FOUND", "message": "This user profile does not exist."},
            )

        # Account unavailable: return minimal safe shell
        if not user.is_active or not user.is_approved:
            return PublicUserProfileResponse(
                id=user.id,
                full_name=user.full_name or "Community Member",
                role=user.role.value,
                member_since=_member_since(user.created_at),
                is_active=user.is_active,
                account_available=False,
            )

        # Build public activity stats (DB-aggregated, real data)
        raw_stats = await self.repo.get_citizen_activity_stats(target_user_id)
        activity = PublicActivityStats(
            submitted=raw_stats.get("submitted", 0),
            approved=raw_stats.get("approved", 0),
            solved=raw_stats.get("solved", 0),
        )

        # Resolve public fields based on role — all relationships already loaded
        profile_picture: str | None = None
        bio: str | None = None
        state: str | None = None
        district: str | None = None
        city: str | None = None
        preferred_language: str | None = None
        interests: list[str] = []

        if user.role.value == "citizen" and user.citizen_profile:
            cp = user.citizen_profile
            profile_picture = cp.profile_picture_url
            bio = getattr(cp, "bio", None)
            state = cp.state if cp.state not in (None, "Default State") else None
            district = cp.district if cp.district not in (None, "Default District") else None
            city = getattr(cp, "city", None)
            preferred_language = getattr(cp, "preferred_language", None)
            interests = getattr(cp, "interests", None) or []
        elif user.profile_detail:
            pd = user.profile_detail
            profile_picture = pd.avatar_url
            bio = pd.bio

        return PublicUserProfileResponse(
            id=user.id,
            full_name=user.full_name or "Community Member",
            profile_picture_url=profile_picture,
            role=user.role.value,
            bio=bio,
            state=state,
            district=district,
            city=city,
            member_since=_member_since(user.created_at),
            preferred_language=preferred_language,
            interests=interests,
            is_active=user.is_active,
            account_available=True,
            activity=activity,
        )

    # ------------------------------------------------------------------
    # Citizen-specific profile (clean civic identity)
    # ------------------------------------------------------------------

    async def get_citizen_profile(self, user: User) -> CitizenProfileResponse:
        """Returns the clean civic profile for a citizen user."""
        cp = await self.repo.get_or_create_citizen_profile(user.id, default_name=user.email.split("@")[0])
        activity_dict = await self.repo.get_citizen_activity_stats(user.id)
        activity = CitizenActivityStats(**activity_dict)

        account_status = "active"
        if not user.is_active:
            account_status = "suspended"
        elif not user.is_approved:
            account_status = "deactivated"

        return CitizenProfileResponse(
            id=cp.id,
            user_id=user.id,
            full_name=cp.full_name,
            email=user.email,
            email_verified=user.is_verified,
            phone_number=cp.phone_number,
            date_of_birth=cp.date_of_birth,
            gender=cp.gender,
            profile_picture_url=cp.profile_picture_url,
            state=cp.state if cp.state != "Default State" else None,
            district=cp.district if cp.district != "Default District" else None,
            city=getattr(cp, "city", None),
            pincode=getattr(cp, "pincode", None),
            bio=getattr(cp, "bio", None) or None,
            preferred_language=getattr(cp, "preferred_language", None),
            interests=getattr(cp, "interests", None) or [],
            role=user.role.value,
            member_since=_member_since(user.created_at),
            account_status=account_status,
            activity=activity,
            created_at=user.created_at,
        )

    async def update_citizen_profile(
        self, user: User, data: CitizenProfileUpdate
    ) -> CitizenProfileResponse:
        """
        Update citizen profile with explicitly whitelisted fields only.
        The schema uses extra='forbid' so no mass-assignment is possible.
        Role, email, account_status, member_since, activity counts are never accepted.
        """
        update_dict = data.model_dump(exclude_unset=True)

        if "bio" in update_dict and update_dict["bio"]:
            update_dict["bio"] = sanitize_bio(update_dict["bio"])

        # Map state/district to location for backward-compat with existing field
        if "state" in update_dict or "district" in update_dict:
            cp = await self.repo.get_citizen_profile(user.id)
            if cp:
                state = update_dict.get("state", cp.state)
                district = update_dict.get("district", cp.district)
                update_dict["location"] = f"{district}, {state}"

        await self.repo.update_citizen_profile(user.id, update_dict)

        # Audit log
        audit = AuditLog(
            actor_id=user.id,
            action="citizen_profile_updated",
            target_type="citizen_profile",
            target_id=str(user.id),
            metadata_json={"updated_fields": list(update_dict.keys())},
        )
        self.db.add(audit)
        await self.db.commit()

        return await self.get_citizen_profile(user)

    # ------------------------------------------------------------------
    # Shared profile (used by Student, Faculty, Industry, University)
    # ------------------------------------------------------------------

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

        # Citizen-specific stats (used in shared response for non-citizen roles too)
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
        """Used by non-citizen roles only. Citizens must use update_citizen_profile()."""
        update_dict = data.model_dump(exclude_unset=True)

        for field in ["website_url", "github_url", "linkedin_url", "avatar_url", "profile_picture_url", "website"]:
            if field in update_dict and update_dict[field] is not None:
                update_dict[field] = str(update_dict[field])

        if "bio" in update_dict and update_dict["bio"]:
            update_dict["bio"] = sanitize_bio(update_dict["bio"])

        if "website_url" in update_dict and "website" not in update_dict:
            update_dict["website"] = update_dict["website_url"]
        await self.repo.update_detail(current_user.id, update_dict)

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
