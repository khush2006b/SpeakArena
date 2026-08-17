"""Alembic environment configuration.

Configures the migration environment to read the database URL
from application settings rather than alembic.ini. This ensures
the same environment variable system is used everywhere.

Supports both online (direct DB connection) and offline
(SQL script generation) migration modes.

Autogenerate behaviour:
    - ``compare_type=True``          Detects column type changes.
    - ``compare_server_default=True`` Detects server_default changes.
    - ``include_schemas=True``        Handles multi-schema projects.
    - Renders UUIDs with the PostgreSQL dialect-specific type.

"""

from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool, text

# Import settings so DATABASE_SYNC_URL is available
from app.config import settings

# Import Base so Alembic can discover all models via metadata.
# All models must be imported in app/models/__init__.py
from app.database import Base
import app.models  # noqa: F401 — ensures all models are registered

# ---------------------------------------------------------------------------
# Alembic Config object (provides access to alembic.ini values)
# ---------------------------------------------------------------------------

config = context.config

# Override the sqlalchemy.url with our settings-based URL
config.set_main_option("sqlalchemy.url", settings.DATABASE_SYNC_URL)

# Set up Python logging from alembic.ini
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Provide metadata for autogenerate support
target_metadata = Base.metadata


# ---------------------------------------------------------------------------
# Autogenerate helpers
# ---------------------------------------------------------------------------


def include_object(object, name, type_, reflected, compare_to):  # type: ignore[no-untyped-def]
    """Filter objects included in autogenerate comparisons.

    Excludes tables that are managed outside Alembic (e.g., PostGIS
    system tables). Extend this function if additional schemas or
    system tables need to be excluded.

    Args:
        object: The SQLAlchemy schema object being considered.
        name: The name of the object.
        type_: The type of the object (e.g., 'table', 'column').
        reflected: Whether the object was reflected from the database.
        compare_to: The object it is being compared to, if any.

    Returns:
        bool: True to include the object in the comparison.
    """
    # Exclude PostGIS / pg_uuidv7 system tables if reflected.
    if type_ == "table" and name in {
        "spatial_ref_sys",
        "geography_columns",
        "geometry_columns",
        "raster_columns",
        "raster_overviews",
    }:
        return False
    return True


# ---------------------------------------------------------------------------
# Migration modes
# ---------------------------------------------------------------------------


def run_migrations_offline() -> None:
    """Run migrations in offline mode (generate SQL script without DB).

    Useful for reviewing what changes a migration will make
    before applying them to production. The generated SQL can
    be reviewed and applied manually.
    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
        include_schemas=True,
        include_object=include_object,
        render_as_batch=False,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in online mode (apply directly to database).

    Creates a synchronous connection to the database and applies
    all pending migrations within a transaction. Uses NullPool so
    that each migration run gets a fresh connection with no pooling
    overhead.
    """
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,  # No pooling for migrations
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            compare_server_default=True,
            include_schemas=True,
            include_object=include_object,
            render_as_batch=False,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
