"""Seed the default teacher account into the database.

Run inside the backend container:
    python -m scripts.seed_teacher

Or via Docker exec:
    docker exec speakarena_api python /app/scripts/seed_teacher.py
"""

import asyncio
import sys
import os

# Make sure app is importable
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.modules.auth.repository import (
    UserRepository,
    StudentProfileRepository,
    EmailVerificationRepository,
    TeacherProfileRepository,
)
from app.modules.auth.service import RegistrationService
from app.core.exceptions.errors import EmailAlreadyExistsError

# ── Teacher credentials — change these before seeding ─────────────────────
TEACHER_EMAIL = "teacher@speakarena.com"
TEACHER_PASSWORD = "Teacher@2024"
TEACHER_FULL_NAME = "SpeakArena Teacher"
TEACHER_BIO = "Professional English speaking coach with 10+ years of experience."
TEACHER_HEADLINE = "English Speaking Expert | SpeakArena"
# ──────────────────────────────────────────────────────────────────────────


async def seed_teacher() -> None:
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    AsyncSessionLocal = sessionmaker(
        bind=engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    async with AsyncSessionLocal() as session:
        user_repo = UserRepository(session)
        student_repo = StudentProfileRepository(session)
        verify_repo = EmailVerificationRepository(session)
        teacher_repo = TeacherProfileRepository(session)

        svc = RegistrationService(
            user_repo=user_repo,
            student_repo=student_repo,
            verify_repo=verify_repo,
        )

        try:
            user = await svc.create_teacher_account(
                email=TEACHER_EMAIL,
                password=TEACHER_PASSWORD,
                full_name=TEACHER_FULL_NAME,
                bio=TEACHER_BIO,
                headline=TEACHER_HEADLINE,
                teacher_repo=teacher_repo,
            )
            await session.commit()
            print(f"✅ Teacher seeded successfully!")
            print(f"   Email   : {user.email}")
            print(f"   Name    : {user.full_name}")
            print(f"   Role    : {user.role}")
            print(f"   ID      : {user.id}")
        except EmailAlreadyExistsError:
            print(f"⚠️  Teacher with email '{TEACHER_EMAIL}' already exists. Skipping.")
        except Exception as e:
            await session.rollback()
            print(f"❌ Error seeding teacher: {e}")
            raise

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed_teacher())
