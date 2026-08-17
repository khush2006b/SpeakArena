"""Resource Management module for SpeakArena.

Manages the complete lifecycle of course content stored in Cloudflare R2:

    Videos : Uploaded by teachers via presigned PUT URLs. Students stream
             via time-limited presigned GET URLs only after enrollment
             verification. Processing status gate ensures only 'published'
             videos are accessible.

    PDFs   : Same upload flow. Presigned GET URLs generated per-request.
             is_downloadable flag controls Content-Disposition header.

Architecture::

    router.py  →  service.py  →  repository.py  →  SQLAlchemy
                      │
                 core/storage/r2.py  (presign / delete / exists)
                      │
                 Redis  (signed URL short-lived cache)

Key R2 Key Naming Convention::

    courses/{course_id}/videos/{video_id}.{ext}   Original video
    courses/{course_id}/videos/{video_id}/hls/    HLS segments prefix
    courses/{course_id}/pdfs/{pdf_id}.pdf         PDF resource
    courses/{course_id}/thumbnail.{ext}           Course thumbnail

Security::

    - No presigned URL is issued without prior enrollment check.
    - Presigned URLs use UUID-based keys, preventing directory traversal.
    - Signed URL cache uses Redis with TTL = (url_expiry - 60s) to prevent
      issuing URLs that are about to expire.
    - Processing status 'published' is the only accessible state for students.
    - MIME type and size validated on upload initiation.
    - File extension derived from MIME type, never from user-supplied filename.

Background Tasks::

    After upload confirmation, FastAPI BackgroundTasks are used for:
        - Updating Video.upload_status = 'completed'
        - Sending teacher notification
        - Future: virus scan, thumbnail generation, HLS transcoding
    The task interface is designed for easy migration to Celery or ARQ.
"""
