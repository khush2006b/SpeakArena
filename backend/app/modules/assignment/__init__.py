"""Assignment module for SpeakArena.

Manages the complete lifecycle of course assignments:

    Assignment         : Teacher-created assignment definitions with title,
                         description (Markdown), due date, max score, and
                         publish gate. Hidden from students until published.

    AssignmentSubmission: Student submissions — file-based (R2) or text.
                         One submission per student per assignment enforced
                         by a database UNIQUE constraint.

    Grading            : Teacher scores and provides feedback. Triggers a
                         notification to the student on grading.

Architecture::

    router.py  →  service.py  →  repository.py  →  SQLAlchemy
                      │
                 core/storage/r2.py  (presign submission file upload)

Security::

    - Students can only view and submit to published assignments.
    - Students must be enrolled in the course.
    - File submissions use presigned R2 PUT URLs; files are never
      transmitted through the backend.
    - One submission per student per assignment (UNIQUE constraint +
      service-layer idempotency check).
    - Late submission flag is set automatically if submitted after due_at
      and allow_late_submission is False raises an error.
    - Only the teacher who owns the course can grade or manage assignments.
"""
