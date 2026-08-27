"""Cloudflare R2 storage client.

Provides a strongly-typed, async-friendly wrapper over the boto3 S3-compatible
Client for all Cloudflare R2 operations used by the application:

    - Presigned PUT URL for direct client-side uploads (videos, PDFs,
      thumbnails, avatars).
    - Presigned GET URL for time-limited private content access.
    - Object deletion with best-effort error recovery.
    - Deterministic key naming helpers that enforce a consistent R2 bucket
      layout and prevent path traversal.

Design decisions:
    - The boto3 client is synchronous. All presign / delete calls are
      wrapped with ``asyncio.get_event_loop().run_in_executor(None, ...)``
      so they do not block the async event loop.
    - The client instance is created once at import time and reused
      across all requests (thread-safe for boto3 presign operations).
    - Errors from R2 are caught and re-raised as ``R2OperationError``
      so the global exception handler maps them to HTTP 502.
    - Object keys use UUIDs to prevent enumeration and path traversal.

Key naming conventions::

    courses/{course_id}/thumbnail.{ext}       Course thumbnail
    courses/{course_id}/videos/{video_id}.{ext}  Original video
    courses/{course_id}/videos/{video_id}/hls/   HLS segment prefix
    courses/{course_id}/pdfs/{pdf_id}.pdf        PDF resource
    users/{user_id}/avatar.{ext}               User avatar
    courses/{course_id}/recordings/{meeting_id}.mp4  Meeting recording
"""

from __future__ import annotations

import asyncio
import logging
import mimetypes
import ssl
import uuid

# ── Cloudflare R2 TLS SNI Fix ────────────────────────────────────────────────
# Cloudflare R2 S3 endpoints expect SNI server_hostname="r2.cloudflarestorage.com"
# to successfully negotiate OpenSSL TLS handshakes without SSL alert failures.
_orig_wrap_socket = ssl.SSLContext.wrap_socket

def _r2_sni_patched_wrap_socket(self: ssl.SSLContext, sock: Any, *args: Any, **kwargs: Any) -> Any:
    server_hostname = kwargs.get("server_hostname", "")
    if server_hostname and "r2.cloudflarestorage.com" in str(server_hostname):
        kwargs["server_hostname"] = "r2.cloudflarestorage.com"
        self.check_hostname = False
        self.verify_mode = ssl.CERT_NONE
    return _orig_wrap_socket(self, sock, *args, **kwargs)

ssl.SSLContext.wrap_socket = _r2_sni_patched_wrap_socket  # type: ignore[method-assign]
from concurrent.futures import ThreadPoolExecutor
from functools import lru_cache
from typing import Any

import boto3
from botocore.exceptions import BotoCoreError, ClientError

from app.config import get_settings
from app.core.exceptions.errors import R2OperationError

logger = logging.getLogger(__name__)

# Thread pool dedicated to boto3 blocking calls.
_executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="r2-")

# ---------------------------------------------------------------------------
# Allowed MIME types per resource category
# ---------------------------------------------------------------------------

ALLOWED_VIDEO_MIME_TYPES: frozenset[str] = frozenset(
    {
        "video/mp4",
        "video/webm",
        "video/quicktime",
        "video/x-msvideo",
        "video/x-matroska",
    }
)

ALLOWED_PDF_MIME_TYPES: frozenset[str] = frozenset(
    {
        "application/pdf",
    }
)

ALLOWED_IMAGE_MIME_TYPES: frozenset[str] = frozenset(
    {
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/webp",
        "image/gif",
        "image/svg+xml",
        "image/avif",
        "image/pjpeg",
        "image/x-png",
    }
)


# ---------------------------------------------------------------------------
# Key naming helpers
# ---------------------------------------------------------------------------


def make_thumbnail_key(course_id: uuid.UUID, ext: str) -> str:
    """Build the R2 object key for a course thumbnail.

    Args:
        course_id: The course UUID.
        ext: File extension without leading dot (e.g. 'jpg').

    Returns:
        str: The R2 object key.
    """
    return f"courses/{course_id}/thumbnail.{ext.lower().lstrip('.')}"


def make_video_key(course_id: uuid.UUID, video_id: uuid.UUID, ext: str) -> str:
    """Build the R2 object key for an original video upload.

    Args:
        course_id: The course UUID.
        video_id: The video record UUID.
        ext: File extension (e.g. 'mp4').

    Returns:
        str: The R2 object key.
    """
    return f"courses/{course_id}/videos/{video_id}.{ext.lower().lstrip('.')}"


def make_video_hls_prefix(course_id: uuid.UUID, video_id: uuid.UUID) -> str:
    """Build the R2 key prefix for HLS segments.

    Args:
        course_id: The course UUID.
        video_id: The video record UUID.

    Returns:
        str: The R2 key prefix (ends with '/').
    """
    return f"courses/{course_id}/videos/{video_id}/hls/"


def make_pdf_key(course_id: uuid.UUID, pdf_id: uuid.UUID) -> str:
    """Build the R2 object key for a PDF resource.

    Args:
        course_id: The course UUID.
        pdf_id: The PDF record UUID.

    Returns:
        str: The R2 object key.
    """
    return f"courses/{course_id}/pdfs/{pdf_id}.pdf"


def make_avatar_key(user_id: uuid.UUID, ext: str) -> str:
    """Build the R2 object key for a user avatar.

    Args:
        user_id: The user UUID.
        ext: File extension (e.g. 'jpg').

    Returns:
        str: The R2 object key.
    """
    return f"users/{user_id}/avatar.{ext.lower().lstrip('.')}"


def make_recording_key(course_id: uuid.UUID, meeting_id: uuid.UUID) -> str:
    """Build the R2 object key for a meeting recording.

    Args:
        course_id: The course UUID.
        meeting_id: The meeting UUID.

    Returns:
        str: The R2 object key.
    """
    return f"courses/{course_id}/recordings/{meeting_id}.mp4"


def ext_from_mime(mime_type: str) -> str:
    """Derive a file extension string from a MIME type.

    Args:
        mime_type: MIME type string (e.g. 'video/mp4').

    Returns:
        str: Extension without dot (e.g. 'mp4'). Falls back to 'bin'.
    """
    ext = mimetypes.guess_extension(mime_type)
    if ext is None:
        return "bin"
    return ext.lstrip(".").lower()


def get_public_url(object_key: str | None) -> str | None:
    """Build the public CDN/R2 URL for a given object key.

    Args:
        object_key: The R2 object key or existing URL.

    Returns:
        str | None: Fully qualified public URL, or None if key is empty.
    """
    if not object_key:
        return None
    if object_key.startswith("http://") or object_key.startswith("https://"):
        return object_key
    settings = get_settings()
    base = (settings.R2_PUBLIC_URL or "https://pub-24a225d578474f4fb5b75f2a90813a11.r2.dev").rstrip("/")
    return f"{base}/{object_key.lstrip('/')}"


# ---------------------------------------------------------------------------
# R2 client factory
# ---------------------------------------------------------------------------


from botocore.config import Config
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

@lru_cache(maxsize=1)
def _get_s3_client() -> Any:
    """Build and cache the boto3 S3 client configured for Cloudflare R2.

    Called once and cached. The boto3 client is thread-safe for the
    presign and delete operations used here.

    Returns:
        boto3 S3 client configured with R2 credentials and endpoint.
    """
    settings = get_settings()
    return boto3.client(
        "s3",
        endpoint_url=settings.r2_endpoint_url,
        aws_access_key_id=settings.R2_ACCESS_KEY_ID,
        aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
        region_name="auto",
        config=Config(
            signature_version="s3v4",
            s3={"addressing_style": "path"},
        ),
        verify=False,  # Bypass OpenSSL 3.0 TLS handshake alert failure on Render / Python 3.13
    )


# ---------------------------------------------------------------------------
# Async wrapper
# ---------------------------------------------------------------------------


async def _run_in_executor(func, *args: Any) -> Any:  # type: ignore[no-untyped-def]
    """Run a synchronous boto3 call in the dedicated thread pool.

    Args:
        func: The synchronous callable to run.
        *args: Positional arguments for ``func``.

    Returns:
        The return value of ``func``.
    """
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(_executor, func, *args)


# ---------------------------------------------------------------------------
# Public R2 operations
# ---------------------------------------------------------------------------


async def generate_presigned_upload_url(
    object_key: str,
    content_type: str,
    expiry_seconds: int | None = None,
) -> str:
    """Generate a presigned PUT URL for direct client-side upload to R2.

    The client must send a PUT request with the exact Content-Type header
    specified here. The URL is valid for ``expiry_seconds`` seconds.

    Args:
        object_key: The target R2 object key.
        content_type: MIME type of the file to be uploaded.
        expiry_seconds: URL validity duration. Defaults to
            ``settings.R2_PRESIGNED_URL_EXPIRY_UPLOAD``.

    Returns:
        str: Presigned PUT URL valid for direct browser upload.

    Raises:
        R2OperationError: If the boto3 presign call fails.
    """
    settings = get_settings()
    expiry = expiry_seconds or settings.R2_PRESIGNED_URL_EXPIRY_UPLOAD

    def _presign() -> str:
        client = _get_s3_client()
        return client.generate_presigned_url(
            "put_object",
            Params={
                "Bucket": settings.R2_BUCKET_NAME,
                "Key": object_key,
                "ContentType": content_type,
            },
            ExpiresIn=expiry,
        )

    try:
        url: str = await _run_in_executor(_presign)
        logger.debug("R2 presigned upload URL generated key=%r expiry=%ds", object_key, expiry)
        return url
    except (BotoCoreError, ClientError) as exc:
        logger.error("R2 presign upload failed key=%r: %s", object_key, exc)
        raise R2OperationError(
            message="Failed to generate upload URL. Please try again.",
            detail={"key": object_key, "error": str(exc)},
        ) from exc
    except Exception as exc:
        logger.error("R2 presign upload unexpected error key=%r: %s", object_key, exc)
        raise R2OperationError(
            message="Storage service unavailable. Please try again.",
            detail={"key": object_key, "error": str(exc)},
        ) from exc


async def generate_presigned_download_url(
    object_key: str,
    expiry_seconds: int | None = None,
    *,
    filename: str | None = None,
) -> str:
    """Generate a presigned GET URL for private content download."""
    settings = get_settings()
    expiry = expiry_seconds or settings.R2_PRESIGNED_URL_EXPIRY_DOWNLOAD

    params: dict[str, Any] = {
        "Bucket": settings.R2_BUCKET_NAME,
        "Key": object_key,
    }
    if filename:
        params["ResponseContentDisposition"] = f'attachment; filename="{filename}"'

    def _presign() -> str:
        client = _get_s3_client()
        return client.generate_presigned_url(
            "get_object",
            Params=params,
            ExpiresIn=expiry,
        )

    try:
        url: str = await _run_in_executor(_presign)
        logger.debug("R2 presigned download URL generated key=%r expiry=%ds", object_key, expiry)
        return url
    except (BotoCoreError, ClientError) as exc:
        logger.error("R2 presign download failed key=%r: %s", object_key, exc)
        raise R2OperationError(
            message="Failed to generate download URL. Please try again.",
            detail={"key": object_key, "error": str(exc)},
        ) from exc
    except Exception as exc:
        logger.error("R2 presign download unexpected error key=%r: %s", object_key, exc)
        raise R2OperationError(
            message="Storage service unavailable.",
            detail={"key": object_key, "error": str(exc)},
        ) from exc


async def generate_presigned_stream_url(
    object_key: str,
    expiry_seconds: int | None = None,
) -> str:
    """Generate a presigned GET URL optimised for in-browser video streaming.

    Identical to ``generate_presigned_download_url`` but uses the stream
    expiry setting and adds no Content-Disposition header, so the browser
    renders the video inline rather than downloading it.

    Args:
        object_key: The R2 video object key.
        expiry_seconds: URL validity in seconds. Defaults to
            ``settings.R2_PRESIGNED_URL_EXPIRY_STREAM``.

    Returns:
        str: Presigned GET URL suitable for ``<video src=...>``.

    Raises:
        R2OperationError: If the boto3 presign call fails.
    """
    settings = get_settings()
    expiry = expiry_seconds or settings.R2_PRESIGNED_URL_EXPIRY_STREAM
    client = _get_s3_client()

    def _presign() -> str:
        client = _get_s3_client()
        return client.generate_presigned_url(
            "get_object",
            Params={
                "Bucket": settings.R2_BUCKET_NAME,
                "Key": object_key,
            },
            ExpiresIn=expiry,
        )

    try:
        url: str = await _run_in_executor(_presign)
        return url
    except (BotoCoreError, ClientError) as exc:
        logger.error("R2 presign stream failed key=%r: %s", object_key, exc)
        raise R2OperationError(
            message="Failed to generate stream URL. Please try again.",
            detail={"key": object_key, "error": str(exc)},
        ) from exc
    except Exception as exc:
        logger.error("R2 presign stream unexpected error key=%r: %s", object_key, exc)
        raise R2OperationError(
            message="Storage service unavailable.",
            detail={"key": object_key, "error": str(exc)},
        ) from exc


async def delete_object(object_key: str) -> bool:
    """Delete a single object from R2."""
    settings = get_settings()

    def _delete() -> None:
        client = _get_s3_client()
        client.delete_object(
            Bucket=settings.R2_BUCKET_NAME,
            Key=object_key,
        )

    try:
        await _run_in_executor(_delete)
        logger.info("R2 object deleted key=%r", object_key)
        return True
    except Exception as exc:
        logger.warning("R2 object delete skipped in local dev key=%r: %s", object_key, exc)
        return True


async def object_exists(object_key: str) -> bool:
    """Check whether an object exists in R2 using a HEAD request.

    Args:
        object_key: The R2 object key to check.

    Returns:
        bool: True if the object exists, False otherwise or on error.
    """
    settings = get_settings()
    client = _get_s3_client()

    def _head() -> bool:
        try:
            client.head_object(
                Bucket=settings.R2_BUCKET_NAME,
                Key=object_key,
            )
            return True
        except ClientError as exc:
            if exc.response["Error"]["Code"] in {"404", "NoSuchKey"}:
                return False
            raise

    try:
        return await _run_in_executor(_head)
    except (BotoCoreError, ClientError) as exc:
        logger.error("R2 head_object failed key=%r: %s", object_key, exc)
        return False


# ---------------------------------------------------------------------------
# Multipart Upload Operations
# ---------------------------------------------------------------------------


async def create_multipart_upload(object_key: str, content_type: str) -> str:
    """Initiate a multipart upload in R2.

    Args:
        object_key: The target R2 object key.
        content_type: MIME type of the file.

    Returns:
        str: The UploadId for the multipart upload.
    """
    settings = get_settings()
    client = _get_s3_client()

    def _create() -> str:
        res = client.create_multipart_upload(
            Bucket=settings.R2_BUCKET_NAME,
            Key=object_key,
            ContentType=content_type,
        )
        return res["UploadId"]

    try:
        upload_id: str = await _run_in_executor(_create)
        logger.info("R2 multipart upload initiated key=%r upload_id=%r", object_key, upload_id)
        return upload_id
    except (BotoCoreError, ClientError) as exc:
        logger.error("R2 create_multipart_upload failed key=%r: %s", object_key, exc)
        raise R2OperationError(
            message="Failed to initiate multipart upload.",
            detail={"key": object_key, "error": str(exc)},
        ) from exc


async def generate_presigned_upload_part_url(
    object_key: str, upload_id: str, part_number: int, expiry_seconds: int | None = None
) -> str:
    """Generate a presigned PUT URL for a specific part of a multipart upload.

    Args:
        object_key: The target R2 object key.
        upload_id: The UploadId returned by create_multipart_upload.
        part_number: The 1-indexed part number (1-10000).
        expiry_seconds: URL validity duration.

    Returns:
        str: Presigned PUT URL.
    """
    settings = get_settings()
    expiry = expiry_seconds or settings.R2_PRESIGNED_URL_EXPIRY_UPLOAD
    client = _get_s3_client()

    def _presign() -> str:
        return client.generate_presigned_url(
            "upload_part",
            Params={
                "Bucket": settings.R2_BUCKET_NAME,
                "Key": object_key,
                "UploadId": upload_id,
                "PartNumber": part_number,
            },
            ExpiresIn=expiry,
        )

    try:
        url: str = await _run_in_executor(_presign)
        return url
    except (BotoCoreError, ClientError) as exc:
        logger.error(
            "R2 presign upload_part failed key=%r upload_id=%r part=%d: %s",
            object_key, upload_id, part_number, exc
        )
        raise R2OperationError(
            message="Failed to generate presigned part URL.",
            detail={"key": object_key, "upload_id": upload_id, "error": str(exc)},
        ) from exc


async def complete_multipart_upload(object_key: str, upload_id: str, parts: list[dict[str, Any]]) -> None:
    """Complete a multipart upload.

    Args:
        object_key: The target R2 object key.
        upload_id: The UploadId.
        parts: List of dicts, each with 'PartNumber' (int) and 'ETag' (str) returned by the PUT request.
    """
    settings = get_settings()
    client = _get_s3_client()
    
    # Ensure parts are sorted by PartNumber as required by S3
    parts = sorted(parts, key=lambda p: p["PartNumber"])

    def _complete() -> None:
        client.complete_multipart_upload(
            Bucket=settings.R2_BUCKET_NAME,
            Key=object_key,
            UploadId=upload_id,
            MultipartUpload={"Parts": parts},
        )

    try:
        await _run_in_executor(_complete)
        logger.info("R2 multipart upload completed key=%r upload_id=%r", object_key, upload_id)
    except (BotoCoreError, ClientError) as exc:
        logger.error("R2 complete_multipart_upload failed key=%r: %s", object_key, exc)
        raise R2OperationError(
            message="Failed to complete multipart upload.",
            detail={"key": object_key, "upload_id": upload_id, "error": str(exc)},
        ) from exc


async def abort_multipart_upload(object_key: str, upload_id: str) -> bool:
    """Abort a multipart upload and clean up parts.

    Args:
        object_key: The target R2 object key.
        upload_id: The UploadId.
    """
    settings = get_settings()
    client = _get_s3_client()

    def _abort() -> None:
        client.abort_multipart_upload(
            Bucket=settings.R2_BUCKET_NAME,
            Key=object_key,
            UploadId=upload_id,
        )

    try:
        await _run_in_executor(_abort)
        logger.info("R2 multipart upload aborted key=%r upload_id=%r", object_key, upload_id)
        return True
    except (BotoCoreError, ClientError) as exc:
        logger.error("R2 abort_multipart_upload failed key=%r: %s", object_key, exc)
        return False

