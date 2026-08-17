"""Student module routers package.

Each sub-module in this package mounts a separate FastAPI APIRouter
registered at the api/v1 level. Routers are thin: they validate
input, call services, and return standardised JSON envelopes.
"""
