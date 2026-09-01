import argparse
import asyncio
import os
import sys

# Ensure all SQLAlchemy models are registered before querying mappers
import app.models  # noqa: F401
from sqlalchemy import select

from app.core.security import get_password_hash
from app.db.session import AsyncSessionLocal
from app.models.account_settings import AccountSettings
from app.models.enums import UserRole
from app.models.user import User
from app.models.user_profile import UserProfileDetail


async def create_admin(email: str, password: str, full_name: str) -> None:
    async with AsyncSessionLocal() as session:
        # 1. Check if ANY Admin user already exists (One-time creation protection)
        admin_query = select(User).where(User.role == UserRole.ADMIN)
        existing_admin = (await session.execute(admin_query)).scalar_one_or_none()
        if existing_admin:
            print(f"⚠️  [NOTICE] An Admin account already exists in the database (Email: {existing_admin.email}).")
            print("One-time creation limit enforced. No new admin account was created.")
            return

        # 2. Check if the specific email is already registered
        email_query = select(User).where(User.email == email.lower())
        existing_user = (await session.execute(email_query)).scalar_one_or_none()
        if existing_user:
            print(f"❌  [ERROR] User with email '{email}' already exists.")
            return

        # 3. Create Super Admin User
        admin_user = User(
            email=email.lower(),
            hashed_password=get_password_hash(password),
            role=UserRole.ADMIN,
            is_verified=True,
            is_active=True,
            is_approved=True,
        )
        session.add(admin_user)
        await session.flush()

        # 4. Create User Profile Detail & Account Settings
        profile_detail = UserProfileDetail(
            user_id=admin_user.id,
            headline="National Governance & System Administrator",
            bio="SamadhanX Platform Administrator overseeing SIH 26043 university & industry problem solver network.",
        )
        account_settings = AccountSettings(
            user_id=admin_user.id,
            email_notifications=True,
            push_notifications=True,
            public_profile=True,
        )
        session.add(profile_detail)
        session.add(account_settings)

        await session.commit()

        print("\n=======================================================")
        print("🎉 SUCCESS: ONE-TIME ADMIN ACCOUNT CREATED SUCCESSFULLY")
        print("=======================================================")
        print(f"  • User ID:   {admin_user.id}")
        print(f"  • Role:      {admin_user.role.value}")
        print(f"  • Email:     {admin_user.email}")
        print(f"  • Full Name: {full_name}")
        print("=======================================================\n")


def main() -> None:
    parser = argparse.ArgumentParser(description="Create a initial one-time Admin user for SamadhanX platform.")
    parser.add_argument("--email", type=str, default=os.getenv("ADMIN_EMAIL", "admin@samadhanx.gov.in"), help="Admin email address")
    parser.add_argument("--password", type=str, default=os.getenv("ADMIN_PASSWORD", "Admin@12345"), help="Admin password")
    parser.add_argument("--name", type=str, default="System Administrator", help="Admin full name")

    args = parser.parse_args()

    if len(args.password) < 8:
        print("❌ Error: Password must be at least 8 characters long.")
        sys.exit(1)

    asyncio.run(create_admin(args.email, args.password, args.name))


if __name__ == "__main__":
    main()
