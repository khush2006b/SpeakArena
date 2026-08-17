"""SpeakArena test suite.

Structure::

    tests/
        conftest.py          Shared pytest fixtures.
        factories.py         Test data factory functions.
        unit/
            security/
                test_hashing.py         Argon2id password hashing tests.
                test_password_policy.py Password complexity policy tests.
                test_jwt.py             JWT creation and decoding tests.
                test_tokens.py          Raw token generation / hashing tests.
            test_schemas.py             Pydantic schema validation tests.
        api/
            test_register.py    POST /auth/register endpoint tests.
            test_login.py       POST /auth/login endpoint tests.
            test_auth_flow.py   Full authentication flow integration tests.
            test_permissions.py Role and permission guard tests.

Test markers::

    unit        No external dependencies. Always run.
    integration Requires TEST_DATABASE_URL and Redis.
    api         Requires the application to be bootstrapped.
    slow        Skipped in quick CI modes.
"""
