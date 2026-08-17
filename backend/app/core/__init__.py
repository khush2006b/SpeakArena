"""Core infrastructure package for the SpeakArena application.

Provides shared infrastructure components:
- logging  : Centralized logging configuration and factory.
- redis    : Connection pool, key builders, and typed operations.
- middleware: Request context and security header injection.
- exceptions: Domain exception hierarchy and FastAPI handlers.
- utils    : Timezone, UUID, datetime, response, and constant helpers.
"""
