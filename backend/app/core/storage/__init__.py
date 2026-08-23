"""Core storage package — Cloudflare R2 integration."""

from app.core.storage import r2
from app.core.storage.r2 import get_public_url

__all__ = ["r2", "get_public_url"]
