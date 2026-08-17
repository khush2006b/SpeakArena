"""Seed script: clean existing students + seed 2 courses, 2 students, 2 enrollments, 2 chat rooms.

Uses raw SQL matched to the ACTUAL database schema (not the ORM model file).

Steps:
  1. DELETE all student users (cascades handle child rows)
  2. Fetch teacher account
  3. DELETE any existing test courses (idempotent)
  4. INSERT 2 courses + 2 chat_rooms
  5. INSERT 2 student users + student_profiles
  6. INSERT 2 enrollments (Alice->IELTS, Bob->Business English)

Run from the backend directory:
    python -m scripts.seed_data
"""

from __future__ import annotations

import asyncio
import io
import os
import sys
import uuid
from datetime import datetime, timezone

# Force UTF-8 output on Windows so the script does not crash on cp1252
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from argon2 import PasswordHasher
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.config import settings

# ── Constants ────────────────────────────────────────────────────────────────
TEACHER_EMAIL = "teacher@speakarena.com"

STUDENTS = [
    {"full_name": "Alice Johnson", "email": "alice@student.com", "password": "Student@2024"},
    {"full_name": "Bob Williams",  "email": "bob@student.com",   "password": "Student@2024"},
    {"full_name": "Charlie Davis", "email": "charlie@student.com", "password": "Student@2024"},
]

COURSES = [
    {
        "title":       "IELTS Speaking Masterclass",
        "slug":        "ielts-speaking-masterclass",
        "tagline":     "Score Band 8+ in IELTS Speaking with proven techniques and practice sessions.",
        "description": (
            "A comprehensive course covering all three parts of the IELTS Speaking test. "
            "You will learn how to structure answers, use advanced vocabulary, "
            "and handle tricky abstract topics with confidence."
        ),
        "level":    "intermediate",
        "language": "en",
        "price":    0.00,
        "status":   "published",
        "visibility": "public",
    },
    {
        "title":       "Business English for Professionals",
        "slug":        "business-english-professionals",
        "tagline":     "Master workplace communication, presentations, and negotiation in English.",
        "description": (
            "Designed for working professionals who need to communicate confidently in "
            "business meetings, emails, presentations, and client calls. "
            "Real-world scenarios, role-plays, and feedback from a certified coach."
        ),
        "level":    "advanced",
        "language": "en",
        "price":    0.00,
        "status":   "published",
        "visibility": "public",
    },
]
# ────────────────────────────────────────────────────────────────────────────

_ph = PasswordHasher()


def _hash(password: str) -> str:
    """Return an Argon2id hash of the given plaintext password."""
    return _ph.hash(password)


def _now() -> datetime:
    """Return current UTC time as a datetime object (asyncpg requires datetime, not str)."""
    return datetime.now(timezone.utc)


async def run_seed() -> None:
    """Execute the full seed sequence inside a single transaction."""
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    AsyncSessionLocal = sessionmaker(
        bind=engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    async with AsyncSessionLocal() as session:
        try:
            now = _now()

            # ── STEP 1: Delete all existing students ──────────────────────
            print("\n[STEP 1] Removing all existing student accounts...")
            result = await session.execute(
                text("SELECT id FROM users WHERE role = 'student'")
            )
            student_ids = [str(row[0]) for row in result.fetchall()]

            if student_ids:
                ids_literal = ", ".join(f"'{sid}'" for sid in student_ids)
                await session.execute(text(f"DELETE FROM course_enrollments WHERE student_id IN ({ids_literal})"))
                await session.execute(text(f"DELETE FROM student_profiles WHERE user_id IN ({ids_literal})"))
                await session.execute(text(f"DELETE FROM users WHERE id IN ({ids_literal})"))
                print(f"   Removed {len(student_ids)} existing student(s) and enrollments.")
            else:
                print("   No existing students found.")

            # ── STEP 2: Fetch teacher ─────────────────────────────────────
            print(f"\n[STEP 2] Fetching teacher ({TEACHER_EMAIL})...")
            result = await session.execute(
                text("SELECT id, full_name FROM users WHERE email = :email AND role = 'teacher'"),
                {"email": TEACHER_EMAIL},
            )
            teacher_row = result.fetchone()
            if teacher_row is None:
                print(f"   ERROR: Teacher '{TEACHER_EMAIL}' not found.")
                print("   Run 'python -m scripts.seed_teacher' first, then retry.")
                await session.rollback()
                return
            teacher_id = str(teacher_row[0])
            teacher_name = teacher_row[1]
            print(f"   OK: {teacher_name} (id={teacher_id})")

            # ── STEP 3: Delete existing test courses (idempotent) ─────────
            print("\n[STEP 3] Clearing any previous test courses...")
            slugs = [c["slug"] for c in COURSES]
            slug_literals = ", ".join(f"'{s}'" for s in slugs)
            await session.execute(
                text(f"DELETE FROM courses WHERE slug IN ({slug_literals})")
            )
            print("   OK: Cleared previous test courses.")

            # ── STEP 4: Create 2 courses + 2 chat rooms ───────────────────
            print("\n[STEP 4] Creating 2 courses with chat rooms...")
            course_ids: list[str] = []

            for idx, c in enumerate(COURSES, start=1):
                cid = str(uuid.uuid4())
                await session.execute(
                    text("""
                        INSERT INTO courses
                            (id, teacher_id, title, slug, tagline, description,
                             level, language, price, currency,
                             status, visibility,
                             total_students, total_videos, total_pdfs,
                             total_duration_seconds,
                             published_at, created_at, updated_at)
                        VALUES
                            (:id, :teacher_id, :title, :slug, :tagline, :description,
                             :level, :language, :price, 'INR',
                             :status, :visibility,
                             0, 0, 0, 0,
                             :now, :now, :now)
                    """),
                    {
                        "id":         cid,
                        "teacher_id": teacher_id,
                        "title":      c["title"],
                        "slug":       c["slug"],
                        "tagline":    c["tagline"],
                        "description": c["description"],
                        "level":      c["level"],
                        "language":   c["language"],
                        "price":      c["price"],
                        "status":     c["status"],
                        "visibility": c["visibility"],
                        "now":        now,
                    },
                )
                course_ids.append(cid)
                print(f"   [{idx}] Course: '{c['title']}' (id={cid})")

                # Chat room for this course
                rid = str(uuid.uuid4())
                await session.execute(
                    text("""
                        INSERT INTO chat_rooms
                            (id, course_id, name, is_active, created_at, updated_at)
                        VALUES
                            (:id, :course_id, :name, true, :now, :now)
                    """),
                    {
                        "id":        rid,
                        "course_id": cid,
                        "name":      f"{c['title']} - Class Chat",
                        "now":       now,
                    },
                )
                print(f"       Chat room created (id={rid})")

            # ── STEP 5: Create 2 students ─────────────────────────────────
            print("\n[STEP 5] Creating 2 student accounts...")
            student_ids_new: list[str] = []

            for s in STUDENTS:
                uid = str(uuid.uuid4())
                await session.execute(
                    text("""
                        INSERT INTO users
                            (id, email, hashed_password, role, full_name,
                             is_active, is_email_verified,
                             failed_login_count, created_at, updated_at)
                        VALUES
                            (:id, :email, :hpw, 'student', :full_name,
                             true, true,
                             0, :now, :now)
                    """),
                    {
                        "id":        uid,
                        "email":     s["email"],
                        "hpw":       _hash(s["password"]),
                        "full_name": s["full_name"],
                        "now":       now,
                    },
                )

                pid = str(uuid.uuid4())
                await session.execute(
                    text("""
                        INSERT INTO student_profiles
                            (id, user_id, preferred_language,
                             total_courses_enrolled, total_courses_completed,
                             metadata, created_at, updated_at)
                        VALUES
                            (:id, :user_id, 'en', 1, 0,
                             '{"source": "seed_script"}'::jsonb,
                             :now, :now)
                    """),
                    {"id": pid, "user_id": uid, "now": now},
                )

                student_ids_new.append(uid)
                print(f"   Created: {s['full_name']} ({s['email']}) id={uid}")

            # ── STEP 6: Enroll students ───────────────────────────────────
            print("\n[STEP 6] Creating enrollments...")
            # Alice (index 0) -> IELTS (index 0)
            # Bob   (index 1) -> Business English (index 1)
            enrollment_pairs = [
                (student_ids_new[0], course_ids[0], STUDENTS[0]["full_name"], COURSES[0]["title"]), # Alice -> IELTS ONLY
                (student_ids_new[1], course_ids[1], STUDENTS[1]["full_name"], COURSES[1]["title"]), # Bob -> Business English ONLY
                (student_ids_new[2], course_ids[0], STUDENTS[2]["full_name"], COURSES[0]["title"]), # Charlie -> IELTS
                (student_ids_new[2], course_ids[1], STUDENTS[2]["full_name"], COURSES[1]["title"]), # Charlie -> Business English
            ]

            for (student_id, course_id, sname, ctitle) in enrollment_pairs:
                eid = str(uuid.uuid4())
                await session.execute(
                    text("""
                        INSERT INTO course_enrollments
                            (id, student_id, course_id, payment_id, status,
                             enrolled_at, expires_at, progress_percent, completed_at,
                             created_at, updated_at)
                        VALUES
                            (:id, :student_id, :course_id, NULL, 'active',
                             :now, NULL, 0.00, NULL,
                             :now, :now)
                    """),
                    {
                        "id":         eid,
                        "student_id": student_id,
                        "course_id":  course_id,
                        "now":        now,
                    },
                )
                # Update the course's total_students counter
                await session.execute(
                    text("UPDATE courses SET total_students = total_students + 1 WHERE id = :cid"),
                    {"cid": course_id},
                )
                print(f"   Enrolled: {sname} -> '{ctitle}'")

            # ── STEP 7: Commit ────────────────────────────────────────────
            await session.commit()
            print("\n" + "=" * 65)
            print("SEED COMPLETE")
            print("=" * 65)
            print("\nTest Credentials:")
            print(f"  Teacher   : {TEACHER_EMAIL} / Teacher@2024")
            for i, (s, (_, cid, sname, ctitle)) in enumerate(
                zip(STUDENTS, enrollment_pairs), start=1
            ):
                print(f"  Student {i} : {s['email']} / {s['password']}")
                print(f"              Enrolled in: '{ctitle}'")
            print()
            print("Chat Room Access (enforced by enrollment gate in ChatRoomService):")
            for _, cid, sname, ctitle in enrollment_pairs:
                print(f"  {sname} can access chat for: '{ctitle}'")
            print(f"  Teacher can access chat for ALL courses")
            print()

        except Exception as exc:
            await session.rollback()
            print(f"\nERROR during seeding: {exc}")
            import traceback
            traceback.print_exc()
            raise

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(run_seed())
