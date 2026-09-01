"""Google OAuth 2.0 service for SpeakArena.

Handles the full Authorization Code flow using httpx (no extra deps):
  1. generate_state_and_store()  → CSRF nonce stored in Redis
  2. build_auth_url()            → Google consent screen URL
  3. exchange_code_for_tokens()  → code → Google tokens via httpx
  4. get_google_user_info()      → verify ID token via Google tokeninfo API
  5. upsert_google_user()        → create or link user in DB

Teacher detection:
  If email == settings.TEACHER_GOOGLE_EMAIL → role = "teacher"
  Otherwise                                 → role = "student"
"""

from __future__ import annotations

import logging
import secrets
import urllib.parse
from dataclasses import dataclass
from datetime import datetime, timezone

import httpx
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.exceptions.errors import AuthenticationError
from app.models.user import StudentProfile, TeacherProfile, User

logger = logging.getLogger(__name__)

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo"

STATE_TTL_SECONDS = 600  # 10 minutes
STATE_REDIS_PREFIX = "oauth_state:"


@dataclass
class GoogleUserInfo:
    """Extracted and verified user info from Google ID token."""

    google_id: str
    email: str
    full_name: str
    picture: str | None
    email_verified: bool


async def generate_state_and_store(redis: Redis) -> str:
    """Generate a CSRF state nonce and persist it in Redis for 10 minutes."""
    state = secrets.token_urlsafe(32)
    await redis.setex(f"{STATE_REDIS_PREFIX}{state}", STATE_TTL_SECONDS, "1")
    return state


async def verify_state(redis: Redis, state: str) -> None:
    """Verify and consume the CSRF state nonce. Raises AuthenticationError if invalid."""
    key = f"{STATE_REDIS_PREFIX}{state}"
    value = await redis.get(key)
    if not value:
        raise AuthenticationError("Invalid or expired OAuth state. Please try again.")
    await redis.delete(key)  # one-time use


def build_auth_url(state: str) -> str:
    """Build the Google OAuth2 consent screen URL."""
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "access_type": "offline",
        "prompt": "select_account",
    }
    return f"{GOOGLE_AUTH_URL}?{urllib.parse.urlencode(params)}"


async def exchange_code_for_tokens(code: str) -> dict:
    """Exchange authorization code for Google tokens (access_token, id_token)."""
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uri": settings.GOOGLE_REDIRECT_URI,
                "grant_type": "authorization_code",
            },
        )
        if response.status_code != 200:
            logger.error("Google token exchange failed: %s", response.text)
            raise AuthenticationError("Failed to exchange Google authorization code.")
        return response.json()


async def get_google_user_info(id_token: str) -> GoogleUserInfo:
    """Verify Google ID token via Google's tokeninfo endpoint and extract user info."""
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(
            GOOGLE_TOKENINFO_URL,
            params={"id_token": id_token},
        )
        if response.status_code != 200:
            logger.error("Google tokeninfo verification failed: %s", response.text)
            raise AuthenticationError("Failed to verify Google identity token.")
        info = response.json()

    # Verify the token was issued for our application
    if info.get("aud") != settings.GOOGLE_CLIENT_ID:
        raise AuthenticationError("Google token audience mismatch.")

    if info.get("email_verified") not in (True, "true"):
        raise AuthenticationError("Google account email is not verified.")

    email = info.get("email", "")
    full_name = info.get("name") or email.split("@")[0]

    return GoogleUserInfo(
        google_id=info["sub"],
        email=email.lower(),
        full_name=full_name,
        picture=info.get("picture"),
        email_verified=True,
    )


async def upsert_google_user(db: AsyncSession, user_info: GoogleUserInfo) -> User:
    """Create or update a user from Google OAuth info.

    Logic:
      - email == TEACHER_GOOGLE_EMAIL → role = 'teacher'
      - otherwise                     → role = 'student'
      - Existing user found by google_id → update last_login, return
      - Existing user found by email    → link google_id, return
      - New user                        → create User + profile
    """
    role = (
        "teacher"
        if user_info.email.lower() == settings.TEACHER_GOOGLE_EMAIL.lower()
        else "student"
    )

    # 1. Look up by google_id (returning user)
    result = await db.execute(
        select(User).where(User.google_id == user_info.google_id)
    )
    user = result.scalar_one_or_none()

    # 2. Look up by email (account linking — user registered before OAuth was added)
    if user is None:
        result = await db.execute(
            select(User).where(User.email == user_info.email.lower())
        )
        user = result.scalar_one_or_none()

    if user is not None:
        # Link / refresh existing account
        user.google_id = user_info.google_id
        user.is_email_verified = True
        user.last_login_at = datetime.now(timezone.utc)
        if not user.full_name:
            user.full_name = user_info.full_name
        await db.flush()
        return user

    # 3. Create new user
    user = User(
        email=user_info.email.lower(),
        hashed_password=None,  # Google users have no password
        full_name=user_info.full_name,
        role=role,
        google_id=user_info.google_id,
        is_active=True,
        is_email_verified=True,
        last_login_at=datetime.now(timezone.utc),
    )
    db.add(user)
    await db.flush()  # populate user.id

    # Create role-specific profile
    if role == "teacher":
        db.add(TeacherProfile(user_id=user.id))
    else:
        db.add(StudentProfile(user_id=user.id))

    await db.flush()
    return user
