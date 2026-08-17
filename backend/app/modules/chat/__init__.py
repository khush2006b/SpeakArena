"""Chat module for SpeakArena.

Implements the full course chat system:

    ChatRoom    : One room per course, auto-created when a course is created.
    Message     : Rich messages with text, images, files, reply threads, pins,
                  announcements, reactions, and soft-delete (tombstones).
    Moderation  : Teacher-only mute, kick, and message deletion.
    Slow Mode   : Per-room cooldown enforced via Redis TTL per user.
    Announcements: Teacher-only broadcast pinned to the room header.

Architecture::

    router.py  →  service.py  →  repository.py  →  SQLAlchemy
                      │
                 Redis (slow-mode TTL, real-time pub/sub)

Security::

    - All read endpoints verify the requester is enrolled in the course
      (or is the teacher) before returning any messages.
    - Muted students can send messages but they are flagged
      is_muted_user_message=True and hidden from other students.
    - Announcements and pins are teacher-only.
    - Slow mode cooldown is enforced server-side via Redis TTL.
    - Soft-deleted message content is replaced with '[Message deleted]'
      and attachments are cleared before the tombstone is committed.
"""
