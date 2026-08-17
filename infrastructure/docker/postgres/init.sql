-- =============================================================================
-- SpeakArena — PostgreSQL Initialization Script
-- Runs once on database container first boot.
-- Creates extensions, optimizes settings, and hardens access.
-- =============================================================================

\set ON_ERROR_STOP on

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";       -- UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";         -- Cryptographic functions
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements"; -- Query performance stats
CREATE EXTENSION IF NOT EXISTS "pg_trgm";          -- Trigram similarity (full-text search)
CREATE EXTENSION IF NOT EXISTS "btree_gin";        -- GIN index support for btree types
CREATE EXTENSION IF NOT EXISTS "unaccent";         -- Accent-insensitive text search

-- pg_uuidv7: pure-SQL fallback (does not need the C extension)
CREATE OR REPLACE FUNCTION uuid_generate_v7()
RETURNS uuid
LANGUAGE sql
VOLATILE PARALLEL SAFE
AS $$
  SELECT encode(
    set_bit(
      set_bit(
        overlay(
          uuid_send(gen_random_uuid())
          placing substring(int8send(floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint) FROM 3)
          FROM 1 FOR 6
        ),
        52, 1
      ),
      53, 1
    ),
    'hex'
  )::uuid
$$;

-- ---------------------------------------------------------------------------
-- Optimized settings for the speakarena_db database
-- ---------------------------------------------------------------------------
ALTER DATABASE speakarena_db SET timezone TO 'UTC';
ALTER DATABASE speakarena_db SET default_text_search_config TO 'pg_catalog.english';
ALTER DATABASE speakarena_db SET log_min_duration_statement TO 1000;  -- Log queries > 1s
ALTER DATABASE speakarena_db SET statement_timeout TO '60s';          -- Kill runaway queries
ALTER DATABASE speakarena_db SET lock_timeout TO '10s';               -- Fail fast on locks
ALTER DATABASE speakarena_db SET idle_in_transaction_session_timeout TO '30s';

-- ---------------------------------------------------------------------------
-- Read-only replica user (for analytics / read replicas)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'speakarena_readonly') THEN
        CREATE ROLE speakarena_readonly WITH
            LOGIN
            PASSWORD 'CHANGE_ME_READONLY_PASSWORD'
            NOSUPERUSER
            NOCREATEDB
            NOCREATEROLE
            NOINHERIT;
    END IF;
END;
$$;

GRANT CONNECT ON DATABASE speakarena_db TO speakarena_readonly;
GRANT USAGE ON SCHEMA public TO speakarena_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO speakarena_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO speakarena_readonly;

-- ---------------------------------------------------------------------------
-- Revoke public schema access from PUBLIC role (security hardening)
-- ---------------------------------------------------------------------------
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- Create index for common search patterns (if tables already exist)
-- ---------------------------------------------------------------------------
-- These are created here as fallbacks; Alembic migrations are the primary source.
-- GIN trigram index on user.full_name for ILIKE search performance:
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_fullname_trgm
--     ON users USING gin (full_name gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Confirmation
-- ---------------------------------------------------------------------------
SELECT 'SpeakArena database initialized successfully' AS status;
