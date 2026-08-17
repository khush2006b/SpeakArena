"""API endpoint tests — require the FastAPI application to be bootstrapped.

All tests in this package use an ``AsyncClient`` configured with
dependency overrides for the database session and Redis client.
No real database or Redis connection is required.
"""
