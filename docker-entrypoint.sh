#!/bin/sh
set -e

echo "[A.R.E.S.] Waiting for database to be ready..."
until psql "$DATABASE_URL" -c '\q' 2>/dev/null; do
  echo "[A.R.E.S.] Database not ready — retrying in 2s..."
  sleep 2
done
echo "[A.R.E.S.] Database is ready."

echo "[A.R.E.S.] Running database migrations..."
psql "$DATABASE_URL" <<'SQL'
  CREATE TABLE IF NOT EXISTS _ares_migrations (
    id serial PRIMARY KEY,
    name text NOT NULL UNIQUE,
    applied_at timestamptz DEFAULT now()
  );
SQL

MIGRATION="0000_initial_schema"
ALREADY_APPLIED=$(psql "$DATABASE_URL" -tAc "SELECT COUNT(*) FROM _ares_migrations WHERE name = '$MIGRATION'")

if [ "$ALREADY_APPLIED" = "0" ]; then
  echo "[A.R.E.S.] Applying migration: $MIGRATION"
  psql "$DATABASE_URL" -f /app/migrations/0000_initial_schema.sql
  psql "$DATABASE_URL" -c "INSERT INTO _ares_migrations (name) VALUES ('$MIGRATION')"
  echo "[A.R.E.S.] Migration applied."
else
  echo "[A.R.E.S.] Migration already applied — skipping."
fi

echo "[A.R.E.S.] Starting server..."
exec node dist/index.cjs
