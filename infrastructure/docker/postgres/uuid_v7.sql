-- =============================================================================
-- UUIDv7 pure-SQL implementation
-- Provides uuid_generate_v7() without the pg_uuidv7 C extension.
-- Compatible with PostgreSQL 14+.
-- =============================================================================

-- uuid_generate_v7() — time-ordered UUID using millisecond epoch timestamp
-- in the top 48 bits and random bytes in the remainder.
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

-- Verify the function works
SELECT uuid_generate_v7() AS sample_uuidv7;
